import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import { RequestError } from "@octokit/request-error";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import {
  FromDataExtensionsEditorMessage,
  ToDataExtensionsEditorMessage,
} from "../common/interface-types";
import { ProgressCallback, withProgress } from "../common/vscode/progress";
import { QueryRunner } from "../query-server";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogErrorMessage,
} from "../common/logging";
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
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { ExtensionPack } from "./shared/extension-pack";
import { autoModel, ModelRequest, ModelResponse } from "./auto-model-api";
import {
  autoModelV2,
  ModelRequest as ModelRequestV2,
  ModelResponse as ModelResponseV2,
} from "./auto-model-api-v2";
import {
  createAutoModelRequest,
  parsePredictedClassifications,
} from "./auto-model";
import {
  enableFrameworkMode,
  showLlmGeneration,
  showModelDetailsView,
  useLlmGenerationV2,
} from "../config";
import { getAutoModelUsages } from "./auto-model-usages-query";
import { Mode } from "./shared/mode";
import { loadModeledMethods, saveModeledMethods } from "./modeled-method-fs";
import { join } from "path";
import { pickExtensionPack } from "./extension-pack-picker";
import { getLanguageDisplayName } from "../common/query-language";
import { runAutoModelQueries } from "./auto-model-codeml-queries";
import { createAutoModelV2Request, getCandidates } from "./auto-model-v2";
import { load as loadYaml } from "js-yaml";
import { loadDataExtensionYaml } from "./yaml";
import { extLogger } from "../common/logging/vscode";

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
    private readonly queryDir: string,
    private readonly databaseItem: DatabaseItem,
    private readonly extensionPack: ExtensionPack,
    private mode: Mode,
    private readonly updateModelDetailsPanelState: (
      externalApiUsages: ExternalApiUsage[],
      databaseItem: DatabaseItem,
    ) => void,
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
      title: `Modeling ${getLanguageDisplayName(
        this.extensionPack.language,
      )} (${this.extensionPack.name})`,
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "data-extensions-editor",
      iconPath: {
        dark: Uri.file(
          join(this.ctx.extensionPath, "media/dark/symbol-misc.svg"),
        ),
        light: Uri.file(
          join(this.ctx.extensionPath, "media/light/symbol-misc.svg"),
        ),
      },
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
      case "openDatabase":
        await this.app.commands.execute(
          "revealInExplorer",
          this.databaseItem.getSourceArchiveExplorerUri(),
        );

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
        await this.handleJumpToUsage(msg.location);

        break;
      case "saveModeledMethods":
        await saveModeledMethods(
          this.extensionPack,
          this.databaseItem.name,
          this.databaseItem.language,
          msg.externalApiUsages,
          msg.modeledMethods,
          this.mode,
          this.cliServer,
          this.app.logger,
        );
        await Promise.all([this.setViewState(), this.loadExternalApiUsages()]);

        break;
      case "generateExternalApi":
        await this.generateModeledMethods();

        break;
      case "generateExternalApiFromLlm":
        if (useLlmGenerationV2()) {
          await this.generateModeledMethodsFromLlmV2(
            msg.externalApiUsages,
            msg.modeledMethods,
          );
        } else {
          await this.generateModeledMethodsFromLlmV1(
            msg.externalApiUsages,
            msg.modeledMethods,
          );
        }
        break;
      case "modelDependency":
        await this.modelDependency();
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
    const showLlmButton =
      this.databaseItem.language === "java" && showLlmGeneration();

    await this.postMessage({
      t: "setDataExtensionEditorViewState",
      viewState: {
        extensionPack: this.extensionPack,
        enableFrameworkMode: enableFrameworkMode(),
        showLlmButton,
        mode: this.mode,
      },
    });
  }

  protected async handleJumpToUsage(location: ResolvableLocationValue) {
    if (showModelDetailsView()) {
      await this.openModelDetailsView();
    } else {
      await this.jumpToUsage(location);
    }
  }

  protected async openModelDetailsView() {
    await this.app.commands.execute("codeQLModelDetails.focus");
  }

  protected async jumpToUsage(
    location: ResolvableLocationValue,
  ): Promise<void> {
    await showResolvableLocation(location, this.databaseItem, this.app.logger);
  }

  protected async loadExistingModeledMethods(): Promise<void> {
    try {
      const modeledMethods = await loadModeledMethods(
        this.extensionPack,
        this.cliServer,
        this.app.logger,
      );
      await this.postMessage({
        t: "loadModeledMethods",
        modeledMethods,
      });
    } catch (e: unknown) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Unable to read data extension YAML: ${getErrorMessage(e)}`,
      );
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    await withProgress(
      async (progress) => {
        try {
          const cancellationTokenSource = new CancellationTokenSource();
          const queryResult = await runQuery(this.mode, {
            cliServer: this.cliServer,
            queryRunner: this.queryRunner,
            databaseItem: this.databaseItem,
            queryStorageDir: this.queryStorageDir,
            queryDir: this.queryDir,
            progress: (update) => progress({ ...update, maxStep: 1500 }),
            token: cancellationTokenSource.token,
          });
          if (!queryResult) {
            return;
          }

          progress({
            message: "Decoding results",
            step: 1100,
            maxStep: 1500,
          });

          const bqrsChunk = await readQueryResults({
            cliServer: this.cliServer,
            bqrsPath: queryResult.outputDir.bqrsPath,
          });
          if (!bqrsChunk) {
            return;
          }

          progress({
            message: "Finalizing results",
            step: 1450,
            maxStep: 1500,
          });

          const externalApiUsages = decodeBqrsToExternalApiUsages(bqrsChunk);

          await this.postMessage({
            t: "setExternalApiUsages",
            externalApiUsages,
          });
          this.updateModelDetailsPanelState(
            externalApiUsages,
            this.databaseItem,
          );
        } catch (err) {
          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(err),
            )`Failed to load external API usages: ${getErrorMessage(err)}`,
          );
        }
      },
      { cancellable: false },
    );
  }

  protected async generateModeledMethods(): Promise<void> {
    await withProgress(
      async (progress) => {
        const tokenSource = new CancellationTokenSource();

        let addedDatabase: DatabaseItem | undefined;

        // In application mode, we need the database of a specific library to generate
        // the modeled methods. In framework mode, we'll use the current database.
        if (this.mode === Mode.Application) {
          addedDatabase = await this.promptChooseNewOrExistingDatabase(
            progress,
          );
          if (!addedDatabase) {
            return;
          }
        }

        progress({
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
            onResults: async (modeledMethods) => {
              const modeledMethodsByName: Record<string, ModeledMethod> = {};

              for (const modeledMethod of modeledMethods) {
                modeledMethodsByName[modeledMethod.signature] = modeledMethod;
              }

              await this.postMessage({
                t: "addModeledMethods",
                modeledMethods: modeledMethodsByName,
              });
            },
            progress,
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
      },
      { cancellable: false },
    );
  }

  private async generateModeledMethodsFromLlmV1(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    await withProgress(async (progress) => {
      const maxStep = 3000;

      progress({
        step: 0,
        maxStep,
        message: "Retrieving usages",
      });

      const usages = await getAutoModelUsages({
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        queryStorageDir: this.queryStorageDir,
        queryDir: this.queryDir,
        databaseItem: this.databaseItem,
        progress: (update) => progress({ ...update, maxStep }),
      });

      progress({
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

      progress({
        step: 2000,
        maxStep,
        message: "Sending request",
      });

      const response = await this.callAutoModelApi(request);
      if (!response) {
        return;
      }

      progress({
        step: 2500,
        maxStep,
        message: "Parsing response",
      });

      const predictedModeledMethods = parsePredictedClassifications(
        response.predicted || [],
      );

      progress({
        step: 2800,
        maxStep,
        message: "Applying results",
      });

      await this.postMessage({
        t: "addModeledMethods",
        modeledMethods: predictedModeledMethods,
      });
    });
  }

  private async generateModeledMethodsFromLlmV2(
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    await withProgress(async (progress) => {
      const maxStep = 3000;

      progress({
        step: 0,
        maxStep,
        message: "Retrieving usages",
      });

      // Fetch the candidates to send to the model
      const candidateMethods = getCandidates(
        this.mode,
        externalApiUsages,
        modeledMethods,
      );

      // If there are no candidates, there is nothing to model and we just return
      if (candidateMethods.length === 0) {
        void extLogger.log("No candidates to model. Stopping.");
        return;
      }

      const usages = await runAutoModelQueries({
        mode: this.mode,
        candidateMethods,
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        queryStorageDir: this.queryStorageDir,
        databaseItem: this.databaseItem,
        progress: (update) => progress({ ...update, maxStep }),
      });
      if (!usages) {
        return;
      }

      progress({
        step: 1800,
        maxStep,
        message: "Creating request",
      });

      const request = await createAutoModelV2Request(this.mode, usages);

      progress({
        step: 2000,
        maxStep,
        message: "Sending request",
      });

      const response = await this.callAutoModelApiV2(request);
      if (!response) {
        return;
      }

      progress({
        step: 2500,
        maxStep,
        message: "Parsing response",
      });

      const models = loadYaml(response.models, {
        filename: "auto-model.yml",
      });

      const loadedMethods = loadDataExtensionYaml(models);
      if (!loadedMethods) {
        return;
      }

      // Any candidate that was part of the response is a negative result
      // meaning that the canidate is not a sink for the kinds that the LLM is checking for.
      // For now we model this as a sink neutral method, however this is subject
      // to discussion.
      for (const candidate of candidateMethods) {
        if (!(candidate.signature in loadedMethods)) {
          loadedMethods[candidate.signature] = {
            type: "neutral",
            kind: "sink",
            input: "",
            output: "",
            provenance: "ai-generated",
            signature: candidate.signature,
            packageName: candidate.packageName,
            typeName: candidate.typeName,
            methodName: candidate.methodName,
            methodParameters: candidate.methodParameters,
          };
        }
      }

      progress({
        step: 2800,
        maxStep,
        message: "Applying results",
      });

      await this.postMessage({
        t: "addModeledMethods",
        modeledMethods: loadedMethods,
      });
    });
  }

  private async modelDependency(): Promise<void> {
    return withProgress(async (progress, token) => {
      const addedDatabase = await this.promptChooseNewOrExistingDatabase(
        progress,
      );
      if (!addedDatabase || token.isCancellationRequested) {
        return;
      }

      const modelFile = await pickExtensionPack(
        this.cliServer,
        addedDatabase,
        this.app.logger,
        progress,
        token,
      );
      if (!modelFile) {
        return;
      }

      const view = new DataExtensionsEditorView(
        this.ctx,
        this.app,
        this.databaseManager,
        this.cliServer,
        this.queryRunner,
        this.queryStorageDir,
        this.queryDir,
        addedDatabase,
        modelFile,
        Mode.Framework,
        this.updateModelDetailsPanelState,
      );
      await view.openView();
    });
  }

  private async promptChooseNewOrExistingDatabase(
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    const language = this.databaseItem.language;
    const databases = this.databaseManager.databaseItems.filter(
      (db) => db.language === language,
    );
    if (databases.length === 0) {
      return await this.promptImportDatabase(progress);
    } else {
      const local = {
        label: "$(database) Use existing database",
        detail: "Use database from the workspace",
      };
      const github = {
        label: "$(repo) Import database",
        detail: "Choose database from GitHub",
      };
      const newOrExistingDatabase = await window.showQuickPick([local, github]);

      if (!newOrExistingDatabase) {
        void this.app.logger.log("No database chosen");
        return;
      }

      if (newOrExistingDatabase === local) {
        const pickedDatabase = await window.showQuickPick(
          databases.map((database) => ({
            label: database.name,
            description: database.language,
            database,
          })),
          {
            placeHolder: "Pick a database",
          },
        );
        if (!pickedDatabase) {
          void this.app.logger.log("No database chosen");
          return;
        }
        return pickedDatabase.database;
      } else {
        return await this.promptImportDatabase(progress);
      }
    }
  }

  private async promptImportDatabase(
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    // The external API methods are in the library source code, so we need to ask
    // the user to import the library database. We need to have the database
    // imported to the query server, so we need to register it to our workspace.
    const makeSelected = false;
    const addedDatabase = await promptImportGithubDatabase(
      this.app.commands,
      this.databaseManager,
      this.app.workspaceStoragePath ?? this.app.globalStoragePath,
      this.app.credentials,
      progress,
      this.cliServer,
      this.databaseItem.language,
      makeSelected,
    );
    if (!addedDatabase) {
      void this.app.logger.log("No database chosen");
      return;
    }

    return addedDatabase;
  }

  private async callAutoModelApi(
    request: ModelRequest,
  ): Promise<ModelResponse | null> {
    try {
      return await autoModel(this.app.credentials, request);
    } catch (e) {
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

  private async callAutoModelApiV2(
    request: ModelRequestV2,
  ): Promise<ModelResponseV2 | null> {
    try {
      return await autoModelV2(this.app.credentials, request);
    } catch (e) {
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
