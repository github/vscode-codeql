import {
  CancellationTokenSource,
  ExtensionContext,
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
import { QueryRunner } from "../queryRunner";
import {
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
} from "../helpers";
import { extLogger } from "../common";
import { outputFile, readFile } from "fs-extra";
import { load as loadYaml } from "js-yaml";
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
import { readQueryResults, runQuery } from "./external-api-usage-query";
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
    private readonly modelFilename: string,
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
    const yaml = createDataExtensionYaml(
      this.databaseItem.language,
      externalApiUsages,
      modeledMethods,
    );

    await outputFile(this.modelFilename, yaml);

    void extLogger.log(`Saved data extension YAML to ${this.modelFilename}`);
  }

  protected async loadExistingModeledMethods(): Promise<void> {
    try {
      const yaml = await readFile(this.modelFilename, "utf8");

      const data = loadYaml(yaml, {
        filename: this.modelFilename,
      });

      const existingModeledMethods = loadDataExtensionYaml(data);

      if (!existingModeledMethods) {
        void showAndLogErrorMessage(
          `Failed to parse data extension YAML ${this.modelFilename}.`,
        );
        return;
      }

      await this.postMessage({
        t: "addModeledMethods",
        modeledMethods: existingModeledMethods,
      });
    } catch (e: unknown) {
      void showAndLogErrorMessage(
        `Unable to read data extension YAML ${
          this.modelFilename
        }: ${getErrorMessage(e)}`,
      );
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    const cancellationTokenSource = new CancellationTokenSource();

    try {
      const queryResult = await runQuery({
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        databaseItem: this.databaseItem,
        queryStorageDir: this.queryStorageDir,
        progress: (progressUpdate: ProgressUpdate) => {
          void this.showProgress(progressUpdate, 1500);
        },
        token: cancellationTokenSource.token,
      });
      if (!queryResult) {
        await this.clearProgress();
        return;
      }

      await this.showProgress({
        message: "Decoding results",
        step: 1100,
        maxStep: 1500,
      });

      const bqrsChunk = await readQueryResults({
        cliServer: this.cliServer,
        bqrsPath: queryResult.outputDir.bqrsPath,
      });
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
        )`Failed to load external API usages: ${getErrorMessage(err)}`,
      );
    }
  }

  protected async generateModeledMethods(): Promise<void> {
    const tokenSource = new CancellationTokenSource();

    const selectedDatabase = this.databaseManager.currentDatabaseItem;

    // The external API methods are in the library source code, so we need to ask
    // the user to import the library database. We need to have the database
    // imported to the query server, so we need to register it to our workspace.
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

    // The library database was set as the current database by importing it,
    // but we need to set it back to the originally selected database.
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
      await generateFlowModel({
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        queryStorageDir: this.queryStorageDir,
        qlDir: workspaceFolder.uri.fsPath,
        databaseItem: database,
        onResults: async (results) => {
          const modeledMethodsByName: Record<string, ModeledMethod> = {};

          for (const result of results) {
            modeledMethodsByName[result.signature] = result.modeledMethod;
          }

          await this.postMessage({
            t: "addModeledMethods",
            modeledMethods: modeledMethodsByName,
            overrideNone: true,
          });
        },
        progress: (update) => this.showProgress(update),
        token: tokenSource.token,
      });
    } catch (e: unknown) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(e),
        )`Failed to generate flow model: ${getErrorMessage(e)}`,
      );
    }

    // After the flow model has been generated, we can remove the temporary database
    // which we used for generating the flow model.
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
}
