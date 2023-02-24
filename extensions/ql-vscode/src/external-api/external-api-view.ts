import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import {
  FromExternalApiMessage,
  ToExternalApiMessage,
} from "../pure/interface-types";
import { qlpackOfDatabase } from "../contextual/queryResolver";
import { CodeQLCliServer } from "../cli";
import { file } from "tmp-promise";
import { readFile, writeFile } from "fs-extra";
import { dump, load } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../helpers";
import { extLogger } from "../common";
import { DatabaseItem } from "../local-databases";
import { QueryRunner } from "../queryRunner";
import {
  createInitialQueryInfo,
  QueryWithResults,
} from "../run-queries-shared";
import { assertNever, getErrorMessage } from "../pure/helpers-pure";
import { ResolvableLocationValue } from "../pure/bqrs-cli-types";
import { showResolvableLocation } from "../interface-utils";
import { DatabaseUI } from "../local-databases-ui";
import { App } from "../common/app";
import { ProgressUpdate } from "../commandRunner";
import { generateFlowModel } from "./generate-flow-model";
import { ModeledMethod } from "./interface";

export class ExternalApiView extends AbstractWebview<
  ToExternalApiMessage,
  FromExternalApiMessage
> {
  public constructor(
    ctx: ExtensionContext,
    private readonly app: App,
    private readonly cli: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly databaseUI: DatabaseUI,
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
      viewId: "external-api-view",
      title: "External API usage",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "external-api",
    };
  }

  protected onPanelDispose(): void {
    // Nothing to do here
  }

  protected async onMessage(msg: FromExternalApiMessage): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();

        break;
      case "applyDataExtensionYaml":
        await this.saveYaml(msg.yaml);
        await this.loadExternalApiUsages();

        break;
      case "jumpToUsage":
        await this.jumpToUsage(msg.location);

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
    void extLogger.log(`Saving data extension YAML: ${yaml}`);

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

  protected async jumpToUsage(
    location: ResolvableLocationValue,
  ): Promise<void> {
    try {
      await showResolvableLocation(location, this.databaseItem);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.match(/File not found/)) {
          void Window.showErrorMessage(
            "Original file of this result is not in the database's source archive.",
          );
        } else {
          void extLogger.log(`Unable to handleMsgFromView: ${e.message}`);
        }
      } else {
        void extLogger.log(`Unable to handleMsgFromView: ${e}`);
      }
    }
  }

  protected async generateExternalApi(): Promise<void> {
    const tokenSource = new CancellationTokenSource();

    const database = await this.databaseUI.handleChooseDatabaseGithub(
      this.app.credentials,
      (update) => this.showProgress(update),
      tokenSource.token,
    );
    if (!database) {
      await this.clearProgress();
      void extLogger.log("No database chosen");

      return;
    }

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
        this.cli,
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

    await this.clearProgress();
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

    void extLogger.log(`Query result: ${JSON.stringify(queryResult)}`);

    const bqrsPath = queryResult.query.resultsPaths.resultsPath;

    void extLogger.log(`BQRS path: ${bqrsPath}`);

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

    void extLogger.log(`Results: ${JSON.stringify(results)}`);

    await this.postMessage({
      t: "setExternalApiRepoResults",
      results,
    });

    await this.clearProgress();
  }

  private async runQuery(): Promise<QueryWithResults | undefined> {
    const qlpacks = await qlpackOfDatabase(this.cli, this.databaseItem);

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

    const queries = await this.cli.resolveQueriesInSuite(
      suiteFile,
      getOnDiskWorkspaceFolders(),
    );

    if (queries.length !== 1) {
      void extLogger.log(`Expected exactly one query, got ${queries.length}`);
      return;
    }

    const query = queries[0];

    const initialInfo = await createInitialQueryInfo(
      Uri.file(query),
      {
        name: this.databaseItem.name,
        databaseUri: this.databaseItem.databaseUri.toString(),
      },
      false,
    );

    const tokenSource = new CancellationTokenSource();

    return this.queryRunner.compileAndRunQueryAgainstDatabase(
      this.databaseItem,
      initialInfo,
      this.queryStorageDir,
      (update) => this.showProgress(update, 1500),
      tokenSource.token,
    );
  }

  private async getResults(bqrsPath: string) {
    const bqrsInfo = await this.cli.bqrsInfo(bqrsPath);
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

    return this.cli.bqrsDecode(bqrsPath, resultSet.name);
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
