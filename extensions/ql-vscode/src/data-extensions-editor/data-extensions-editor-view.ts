import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  workspace,
} from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import {
  FromDataExtensionsEditorMessage,
  ToDataExtensionsEditorMessage,
} from "../pure/interface-types";
import { ProgressUpdate } from "../progress";
import { extLogger, TeeLogger } from "../common";
import { CoreCompletedQuery, QueryRunner } from "../queryRunner";
import { qlpackOfDatabase } from "../contextual/queryResolver";
import { file } from "tmp-promise";
import { readFile, writeFile } from "fs-extra";
import { dump, load } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../helpers";
import { DatabaseItem, DatabaseManager } from "../local-databases";
import { CodeQLCliServer } from "../cli";
import { assertNever, getErrorMessage } from "../pure/helpers-pure";
import { generateFlowModel } from "./generate-flow-model";
import { ModeledMethod } from "./interface";
import { promptImportGithubDatabase } from "../databaseFetcher";
import { App } from "../common/app";

export class DataExtensionsEditorView extends AbstractWebview<
  ToDataExtensionsEditorMessage,
  FromDataExtensionsEditorMessage
> {
  public constructor(
    ctx: ExtensionContext,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
    private readonly databaseItem: DatabaseItem,
  ) {
    super(ctx);
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    return {
      viewId: "data-extensions-editor",
      title: "Data Extensions Editor",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "data-extensions-editor",
    };
  }

  protected onPanelDispose(): void {
    // Nothing to do here
  }

  protected async onMessage(
    msg: FromDataExtensionsEditorMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();

        break;
      case "applyDataExtensionYaml":
        await this.saveYaml(msg.yaml);
        await this.loadExternalApiUsages();

        break;
      case "generateExternalApi":
        await this.generateExternalApi();

        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await Promise.all([this.loadExternalApiUsages(), this.readExistingYaml()]);
  }

  protected async saveYaml(yaml: string): Promise<void> {
    const modelFilename = this.modelFileName;
    if (!modelFilename) {
      return;
    }

    await writeFile(modelFilename, yaml);

    void extLogger.log(`Saved data extension YAML to ${modelFilename}`);
  }

  protected async readExistingYaml(): Promise<void> {
    const modelFilename = this.modelFileName;
    if (!modelFilename) {
      return;
    }

    try {
      const yaml = await readFile(modelFilename, "utf8");

      const data = load(yaml, {
        filename: modelFilename,
      });

      await this.postMessage({
        t: "setExistingYamlData",
        data,
      });
    } catch (e: unknown) {
      void extLogger.log(`Unable to read data extension YAML: ${e}`);
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    const queryResult = await this.runQuery();
    if (!queryResult) {
      await this.clearProgress();
      return;
    }

    await this.showProgress({
      message: "Loading results",
      step: 1100,
      maxStep: 1500,
    });

    const bqrsPath = queryResult.outputDir.bqrsPath;

    const results = await this.getResults(bqrsPath);
    if (!results) {
      await this.clearProgress();
      return;
    }

    await this.showProgress({
      message: "Finalizing results",
      step: 1450,
      maxStep: 1500,
    });

    await this.postMessage({
      t: "setExternalApiRepoResults",
      results,
    });

    await this.clearProgress();
  }

  protected async generateExternalApi(): Promise<void> {
    const tokenSource = new CancellationTokenSource();

    const selectedDatabase = this.databaseManager.currentDatabaseItem;

    const database = await promptImportGithubDatabase(
      this.app.commands,
      this.databaseManager,
      this.app.workspaceStoragePath ?? this.app.globalStoragePath,
      this.app.credentials,
      (update) => this.showProgress(update),
      tokenSource.token,
      this.cliServer,
    );
    if (!database) {
      await this.clearProgress();
      void extLogger.log("No database chosen");

      return;
    }

    await this.databaseManager.setCurrentDatabaseItem(selectedDatabase);

    const workspaceFolder = workspace.workspaceFolders?.find(
      (folder) => folder.name === "ql",
    );
    if (!workspaceFolder) {
      void extLogger.log("No workspace folder 'ql' found");

      return;
    }

    await this.showProgress({
      step: 0,
      maxStep: 4000,
      message: "Generating external API",
    });

    try {
      await generateFlowModel(
        this.cliServer,
        this.queryRunner,
        this.queryStorageDir,
        workspaceFolder.uri.fsPath,
        database,
        async (results) => {
          const modeledMethodsByName: Record<string, ModeledMethod> = {};

          for (const result of results) {
            modeledMethodsByName[result[0]] = result[1];
          }

          await this.postMessage({
            t: "addModeledMethods",
            modeledMethods: modeledMethodsByName,
          });
        },
        (update) => this.showProgress(update),
        tokenSource.token,
      );
    } catch (e: unknown) {
      void extLogger.log(`Error: ${getErrorMessage(e)}`);
    }

    await this.databaseManager.removeDatabaseItem(
      () =>
        this.showProgress({
          step: 3900,
          maxStep: 4000,
          message: "Removing temporary database",
        }),
      tokenSource.token,
      database,
    );

    await this.clearProgress();
  }

  private async runQuery(): Promise<CoreCompletedQuery | undefined> {
    const qlpacks = await qlpackOfDatabase(this.cliServer, this.databaseItem);

    const packsToSearch = [qlpacks.dbschemePack];
    if (qlpacks.queryPack) {
      packsToSearch.push(qlpacks.queryPack);
    }

    const suiteFile = (
      await file({
        postfix: ".qls",
      })
    ).path;
    const suiteYaml = [];
    for (const qlpack of packsToSearch) {
      suiteYaml.push({
        from: qlpack,
        queries: ".",
        include: {
          id: `${this.databaseItem.language}/telemetry/fetch-external-apis`,
        },
      });
    }
    await writeFile(suiteFile, dump(suiteYaml), "utf8");

    const queries = await this.cliServer.resolveQueriesInSuite(
      suiteFile,
      getOnDiskWorkspaceFolders(),
    );

    if (queries.length !== 1) {
      void extLogger.log(`Expected exactly one query, got ${queries.length}`);
      return;
    }

    const query = queries[0];

    const tokenSource = new CancellationTokenSource();

    const queryRun = this.queryRunner.createQueryRun(
      this.databaseItem.databaseUri.fsPath,
      { queryPath: query, quickEvalPosition: undefined },
      false,
      getOnDiskWorkspaceFolders(),
      undefined,
      this.queryStorageDir,
      undefined,
      undefined,
    );

    return queryRun.evaluate(
      (update) => this.showProgress(update, 1500),
      tokenSource.token,
      new TeeLogger(this.queryRunner.logger, queryRun.outputDir.logPath),
    );
  }

  private async getResults(bqrsPath: string) {
    const bqrsInfo = await this.cliServer.bqrsInfo(bqrsPath);
    if (bqrsInfo["result-sets"].length !== 1) {
      void extLogger.log(
        `Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
      );
      return undefined;
    }

    const resultSet = bqrsInfo["result-sets"][0];

    await this.showProgress({
      message: "Decoding results",
      step: 1200,
      maxStep: 1500,
    });

    return this.cliServer.bqrsDecode(bqrsPath, resultSet.name);
  }

  private async showProgress(update: ProgressUpdate, maxStep?: number) {
    await this.postMessage({
      t: "showProgress",
      step: update.step,
      maxStep: maxStep ?? update.maxStep,
      message: update.message,
    });
  }

  private async clearProgress() {
    await this.showProgress({
      step: 0,
      maxStep: 0,
      message: "",
    });
  }

  private get modelFileName(): string | undefined {
    const workspaceFolder = workspace.workspaceFolders?.find(
      (folder) => folder.name === "ql",
    );
    if (!workspaceFolder) {
      void extLogger.log("No workspace folder 'ql' found");

      return;
    }

    return Uri.joinPath(
      workspaceFolder.uri,
      "java/ql/lib/ext",
      `${this.databaseItem.name.replaceAll("/", ".")}.model.yml`,
    ).fsPath;
  }
}
