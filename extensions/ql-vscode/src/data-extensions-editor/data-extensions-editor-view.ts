import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceFolder,
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
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "../helpers";
import { DatabaseItem, DatabaseManager } from "../local-databases";
import { CodeQLCliServer } from "../cli";
import { asError, assertNever, getErrorMessage } from "../pure/helpers-pure";
import { generateFlowModel } from "./generate-flow-model";
import { promptImportGithubDatabase } from "../databaseFetcher";
import { App } from "../common/app";
import { ResolvableLocationValue } from "../pure/bqrs-cli-types";
import { showResolvableLocation } from "../interface-utils";
import { decodeBqrsToExternalApiUsages } from "./bqrs";
import { redactableError } from "../pure/errors";
import { createDataExtensionYaml, loadDataExtensionYaml } from "./yaml";
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";

function getQlSubmoduleFolder(): WorkspaceFolder | undefined {
  const workspaceFolder = workspace.workspaceFolders?.find(
    (folder) => folder.name === "ql",
  );
  if (!workspaceFolder) {
    void extLogger.log("No workspace folder 'ql' found");

    return;
  }

  return workspaceFolder;
}

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
      case "jumpToUsage":
        await this.jumpToUsage(msg.location);

        break;
      case "saveModeledMethods":
        await this.saveModeledMethods(
          msg.externalApiUsages,
          msg.modeledMethods,
        );
        await this.loadExternalApiUsages();

        break;
      case "generateExternalApi":
        await this.generateModeledMethods();

        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await Promise.all([
      this.loadExternalApiUsages(),
      this.loadExistingModeledMethods(),
    ]);
  }

  protected async jumpToUsage(
    location: ResolvableLocationValue,
  ): Promise<void> {
    try {
      await showResolvableLocation(location, this.databaseItem);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.match(/File not found/)) {
          void window.showErrorMessage(
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

  protected async saveModeledMethods(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    const modelFilename = this.calculateModelFilename();
    if (!modelFilename) {
      return;
    }

    const yaml = createDataExtensionYaml(externalApiUsages, modeledMethods);

    await writeFile(modelFilename, yaml);

    void extLogger.log(`Saved data extension YAML to ${modelFilename}`);
  }

  protected async loadExistingModeledMethods(): Promise<void> {
    const modelFilename = this.calculateModelFilename();
    if (!modelFilename) {
      return;
    }

    try {
      const yaml = await readFile(modelFilename, "utf8");

      const data = loadYaml(yaml, {
        filename: modelFilename,
      });

      const existingModeledMethods = loadDataExtensionYaml(data);

      if (!existingModeledMethods) {
        void showAndLogWarningMessage("Failed to parse data extension YAML.");
        return;
      }

      await this.postMessage({
        t: "addModeledMethods",
        modeledMethods: existingModeledMethods,
      });
    } catch (e: unknown) {
      void extLogger.log(`Unable to read data extension YAML: ${e}`);
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    try {
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

      const bqrsChunk = await this.getResults(bqrsPath);
      if (!bqrsChunk) {
        await this.clearProgress();
        return;
      }

      await this.showProgress({
        message: "Finalizing results",
        step: 1450,
        maxStep: 1500,
      });

      const externalApiUsages = decodeBqrsToExternalApiUsages(bqrsChunk);

      await this.postMessage({
        t: "setExternalApiUsages",
        externalApiUsages,
      });

      await this.clearProgress();
    } catch (err) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(err),
        )`Failed to load external APi usages: ${getErrorMessage(err)}`,
      );
    }
  }

  protected async generateModeledMethods(): Promise<void> {
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

    const workspaceFolder = getQlSubmoduleFolder();
    if (!workspaceFolder) {
      return;
    }

    await this.showProgress({
      step: 0,
      maxStep: 4000,
      message: "Generating modeled methods for library",
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
            overrideNone: true,
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
    await writeFile(suiteFile, dumpYaml(suiteYaml), "utf8");

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

  /*
   * Progress in this class is a bit weird. Most of the progress is based on running the query.
   * Query progress is always between 0 and 1000. However, we still have some steps that need
   * to be done after the query has finished. Therefore, the maximum step is 1500. This captures
   * that there's 1000 steps of the query progress since that takes the most time, and then
   * an additional 500 steps for the rest of the work. The progress doesn't need to be 100%
   * accurate, so this is just a rough estimate.
   *
   * For generating the modeled methods for an external library, the max step is 4000. This is
   * based on the following steps:
   * - 1000 for the summary model
   * - 1000 for the sink model
   * - 1000 for the source model
   * - 1000 for the neutral model
   */
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

  private calculateModelFilename(): string | undefined {
    const workspaceFolder = getQlSubmoduleFolder();
    if (!workspaceFolder) {
      return;
    }

    return Uri.joinPath(
      workspaceFolder.uri,
      "java/ql/lib/ext",
      `${this.databaseItem.name.replaceAll("/", ".")}.model.yml`,
    ).fsPath;
  }
}
