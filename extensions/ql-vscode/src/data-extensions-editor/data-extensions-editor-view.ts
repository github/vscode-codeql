import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import { join } from "path";
import { RequestError } from "@octokit/request-error";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import {
  FromDataExtensionsEditorMessage,
  ToDataExtensionsEditorMessage,
} from "../common/interface-types";
import { ProgressUpdate } from "../common/vscode/progress";
import { QueryRunner } from "../query-server";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogErrorMessage,
} from "../common/logging";
import { outputFile, readFile } from "fs-extra";
import { load as loadYaml } from "js-yaml";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { asError, assertNever, getErrorMessage } from "../common/helpers-pure";
import { generateFlowModel } from "./generate-flow-model";
import { promptImportGithubDatabase } from "../databases/database-fetcher";
import { App } from "../common/app";
import { ResolvableLocationValue } from "../common/bqrs-cli-types";
import { showResolvableLocation } from "../databases/local-databases/locations";
import { decodeBqrsToExternalApiUsages } from "./bqrs";
import { redactableError } from "../common/errors";
import { readQueryResults, runQuery } from "./external-api-usage-query";
import {
  createDataExtensionYamlsForApplicationMode,
  createDataExtensionYamlsForFrameworkMode,
  loadDataExtensionYaml,
} from "./yaml";
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { ExtensionPack } from "./shared/extension-pack";
import { autoModel, ModelRequest, ModelResponse } from "./auto-model-api";
import {
  createAutoModelRequest,
  parsePredictedClassifications,
} from "./auto-model";
import { enableFrameworkMode, showLlmGeneration } from "../config";
import { getAutoModelUsages } from "./auto-model-usages-query";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { Mode } from "./shared/mode";

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
    private readonly extensionPack: ExtensionPack,
    private mode: Mode = Mode.Application,
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
      case "openExtensionPack":
        await this.app.commands.execute(
          "revealInExplorer",
          Uri.file(this.extensionPack.path),
        );

        break;
      case "refreshExternalApiUsages":
        await this.loadExternalApiUsages();

        break;
      case "jumpToUsage":
        await this.jumpToUsage(msg.location);

        break;
      case "saveModeledMethods":
        await this.saveModeledMethods(
          msg.externalApiUsages,
          msg.modeledMethods,
        );
        await Promise.all([this.setViewState(), this.loadExternalApiUsages()]);

        break;
      case "generateExternalApi":
        await this.generateModeledMethods();

        break;
      case "generateExternalApiFromLlm":
        await this.generateModeledMethodsFromLlm(
          msg.externalApiUsages,
          msg.modeledMethods,
        );

        break;
      case "switchMode":
        this.mode = msg.mode;

        await Promise.all([this.setViewState(), this.loadExternalApiUsages()]);

        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await Promise.all([
      this.setViewState(),
      this.loadExternalApiUsages(),
      this.loadExistingModeledMethods(),
    ]);
  }

  private async setViewState(): Promise<void> {
    await this.postMessage({
      t: "setDataExtensionEditorViewState",
      viewState: {
        extensionPack: this.extensionPack,
        enableFrameworkMode: enableFrameworkMode(),
        showLlmButton: showLlmGeneration(),
        mode: this.mode,
      },
    });
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
          void this.app.logger.log(`Unable to handleMsgFromView: ${e.message}`);
        }
      } else {
        void this.app.logger.log(`Unable to handleMsgFromView: ${e}`);
      }
    }
  }

  protected async saveModeledMethods(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    let yamls: Record<string, string>;
    switch (this.mode) {
      case Mode.Application:
        yamls = createDataExtensionYamlsForApplicationMode(
          this.databaseItem.language,
          externalApiUsages,
          modeledMethods,
        );
        break;
      case Mode.Framework:
        yamls = createDataExtensionYamlsForFrameworkMode(
          this.databaseItem.name,
          this.databaseItem.language,
          externalApiUsages,
          modeledMethods,
        );
        break;
      default:
        assertNever(this.mode);
    }

    for (const [filename, yaml] of Object.entries(yamls)) {
      await outputFile(join(this.extensionPack.path, filename), yaml);
    }

    void this.app.logger.log(`Saved data extension YAML`);
  }

  protected async loadExistingModeledMethods(): Promise<void> {
    try {
      const extensions = await this.cliServer.resolveExtensions(
        this.extensionPack.path,
        getOnDiskWorkspaceFolders(),
      );

      const modelFiles = new Set<string>();

      if (this.extensionPack.path in extensions.data) {
        for (const extension of extensions.data[this.extensionPack.path]) {
          modelFiles.add(extension.file);
        }
      }

      const existingModeledMethods: Record<string, ModeledMethod> = {};

      for (const modelFile of modelFiles) {
        const yaml = await readFile(modelFile, "utf8");

        const data = loadYaml(yaml, {
          filename: modelFile,
        });

        const modeledMethods = loadDataExtensionYaml(data);
        if (!modeledMethods) {
          void showAndLogErrorMessage(
            this.app.logger,
            `Failed to parse data extension YAML ${modelFile}.`,
          );
          continue;
        }

        for (const [key, value] of Object.entries(modeledMethods)) {
          existingModeledMethods[key] = value;
        }
      }

      await this.postMessage({
        t: "addModeledMethods",
        modeledMethods: existingModeledMethods,
        unsaved: false,
      });
    } catch (e: unknown) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Unable to read data extension YAML: ${getErrorMessage(e)}`,
      );
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    const cancellationTokenSource = new CancellationTokenSource();

    try {
      const queryResult = await runQuery(
        this.mode === Mode.Framework
          ? "frameworkModeQuery"
          : "applicationModeQuery",
        {
          cliServer: this.cliServer,
          queryRunner: this.queryRunner,
          databaseItem: this.databaseItem,
          queryStorageDir: this.queryStorageDir,
          progress: (progressUpdate: ProgressUpdate) => {
            void this.showProgress(progressUpdate, 1500);
          },
          token: cancellationTokenSource.token,
        },
      );
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
        this.app.logger,
        this.app.telemetry,
        redactableError(
          asError(err),
        )`Failed to load external API usages: ${getErrorMessage(err)}`,
      );
    }
  }

  protected async generateModeledMethods(): Promise<void> {
    const tokenSource = new CancellationTokenSource();

    let addedDatabase: DatabaseItem | undefined;

    // In application mode, we need the database of a specific library to generate
    // the modeled methods. In framework mode, we'll use the current database.
    if (this.mode === Mode.Application) {
      const selectedDatabase = this.databaseManager.currentDatabaseItem;

      // The external API methods are in the library source code, so we need to ask
      // the user to import the library database. We need to have the database
      // imported to the query server, so we need to register it to our workspace.
      addedDatabase = await promptImportGithubDatabase(
        this.app.commands,
        this.databaseManager,
        this.app.workspaceStoragePath ?? this.app.globalStoragePath,
        this.app.credentials,
        (update) => this.showProgress(update),
        this.cliServer,
      );
      if (!addedDatabase) {
        await this.clearProgress();
        void this.app.logger.log("No database chosen");

        return;
      }

      // The library database was set as the current database by importing it,
      // but we need to set it back to the originally selected database.
      await this.databaseManager.setCurrentDatabaseItem(selectedDatabase);
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
        databaseItem: addedDatabase ?? this.databaseItem,
        onResults: async (results) => {
          const modeledMethodsByName: Record<string, ModeledMethod> = {};

          for (const result of results) {
            modeledMethodsByName[result.signature] = result.modeledMethod;
          }

          await this.postMessage({
            t: "addModeledMethods",
            modeledMethods: modeledMethodsByName,
            unsaved: true,
            overrideNone: true,
          });
        },
        progress: (update) => this.showProgress(update),
        token: tokenSource.token,
      });
    } catch (e: unknown) {
      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError(
          asError(e),
        )`Failed to generate flow model: ${getErrorMessage(e)}`,
      );
    }

    if (addedDatabase) {
      // After the flow model has been generated, we can remove the temporary database
      // which we used for generating the flow model.
      await this.showProgress({
        step: 3900,
        maxStep: 4000,
        message: "Removing temporary database",
      });
      await this.databaseManager.removeDatabaseItem(addedDatabase);
    }

    await this.clearProgress();
  }

  private async generateModeledMethodsFromLlm(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    const maxStep = 3000;

    await this.showProgress({
      step: 0,
      maxStep,
      message: "Retrieving usages",
    });

    const usages = await getAutoModelUsages({
      cliServer: this.cliServer,
      queryRunner: this.queryRunner,
      queryStorageDir: this.queryStorageDir,
      databaseItem: this.databaseItem,
      progress: (update) => this.showProgress(update, maxStep),
    });

    await this.showProgress({
      step: 1800,
      maxStep,
      message: "Creating request",
    });

    const request = createAutoModelRequest(
      this.databaseItem.language,
      externalApiUsages,
      modeledMethods,
      usages,
      this.mode,
    );

    await this.showProgress({
      step: 2000,
      maxStep,
      message: "Sending request",
    });

    const response = await this.callAutoModelApi(request);
    if (!response) {
      return;
    }

    await this.showProgress({
      step: 2500,
      maxStep,
      message: "Parsing response",
    });

    const predictedModeledMethods = parsePredictedClassifications(
      response.predicted || [],
    );

    await this.showProgress({
      step: 2800,
      maxStep,
      message: "Applying results",
    });

    await this.postMessage({
      t: "addModeledMethods",
      modeledMethods: predictedModeledMethods,
      unsaved: true,
      overrideNone: true,
    });

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

  private async callAutoModelApi(
    request: ModelRequest,
  ): Promise<ModelResponse | null> {
    try {
      return await autoModel(this.app.credentials, request);
    } catch (e) {
      await this.clearProgress();

      if (e instanceof RequestError && e.status === 429) {
        void showAndLogExceptionWithTelemetry(
          this.app.logger,
          this.app.telemetry,
          redactableError(e)`Rate limit hit, please try again soon.`,
        );
        return null;
      } else {
        throw e;
      }
    }
  }
}
