import type { CancellationToken, Tab } from "vscode";
import {
  CancellationTokenSource,
  ProgressLocation,
  TabInputWebview,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import type { WebviewPanelConfig } from "../common/vscode/abstract-webview";
import { AbstractWebview } from "../common/vscode/abstract-webview";
import type {
  FromModelEditorMessage,
  ToModelEditorMessage,
} from "../common/interface-types";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import type { QueryRunner } from "../query-server";
import {
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
} from "../common/logging";
import type {
  DatabaseItem,
  DatabaseManager,
} from "../databases/local-databases";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { asError, assertNever, getErrorMessage } from "../common/helpers-pure";
import type { DatabaseFetcher } from "../databases/database-fetcher";
import type { App } from "../common/app";
import { redactableError } from "../common/errors";
import {
  externalApiQueriesProgressMaxStep,
  runModelEditorQueries,
} from "./model-editor-queries";
import type { MethodSignature } from "./method";
import type { ModeledMethod } from "./modeled-method";
import type { ExtensionPack } from "./shared/extension-pack";
import type { ModelConfigListener } from "../config";
import { Mode } from "./shared/mode";
import {
  GENERATED_MODELS_SUFFIX,
  loadModeledMethods,
  saveModeledMethods,
} from "./modeled-method-fs";
import { pickExtensionPack } from "./extension-pack-picker";
import type { QueryLanguage } from "../common/query-language";
import { getLanguageDisplayName } from "../common/query-language";
import { telemetryListener } from "../common/vscode/telemetry";
import type { ModelingStore } from "./modeling-store";
import type { ModelingEvents } from "./modeling-events";
import type { ModelsAsDataLanguage } from "./languages";
import {
  AutoModelGenerationType,
  createModelConfig,
  getModelsAsDataLanguage,
} from "./languages";
import { runGenerateQueries } from "./generate";
import { ResponseError } from "vscode-jsonrpc";
import { LSPErrorCodes } from "vscode-languageclient";
import type { AccessPathSuggestionOptions } from "./suggestions";
import { runSuggestionsQuery } from "./suggestion-queries";
import { parseAccessPathSuggestionRowsToOptions } from "./suggestions-bqrs";
import { ModelEvaluator } from "./model-evaluator";
import type { ModelEvaluationRunState } from "./shared/model-evaluation-run-state";
import type { VariantAnalysisManager } from "../variant-analysis/variant-analysis-manager";
import type { ModelExtensionFile } from "./model-extension-file";
import { modelExtensionFileToYaml } from "./yaml";
import { outputFile } from "fs-extra";
import { join } from "path";

export class ModelEditorView extends AbstractWebview<
  ToModelEditorMessage,
  FromModelEditorMessage
> {
  private readonly modelEvaluator: ModelEvaluator;
  private readonly languageDefinition: ModelsAsDataLanguage;
  // Cancellation token source that can be used for passing into long-running operations. Should only
  // be cancelled when the view is closed
  private readonly cancellationTokenSource = new CancellationTokenSource();

  public constructor(
    protected readonly app: App,
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    private readonly modelConfig: ModelConfigListener,
    private readonly databaseManager: DatabaseManager,
    private readonly databaseFetcher: DatabaseFetcher,
    private readonly variantAnalysisManager: VariantAnalysisManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
    private readonly queryDir: string,
    private readonly databaseItem: DatabaseItem,
    private readonly extensionPack: ExtensionPack,
    // The language is equal to databaseItem.language but is properly typed as QueryLanguage
    private readonly language: QueryLanguage,
    initialMode: Mode,
  ) {
    super(app);

    this.push({
      dispose: () => {
        this.cancellationTokenSource.cancel();
      },
    });

    this.modelingStore.initializeStateForDb(databaseItem, initialMode);
    this.registerToModelingEvents();
    this.registerToModelConfigEvents();

    this.languageDefinition = getModelsAsDataLanguage(language);

    this.modelEvaluator = new ModelEvaluator(
      this.app,
      this.cliServer,
      modelingStore,
      modelingEvents,
      this.variantAnalysisManager,
      databaseItem,
      language,
      this.extensionPack,
      this.updateModelEvaluationRun.bind(this),
    );
    this.push(this.modelEvaluator);
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    panel.onDidChangeViewState(async () => {
      if (panel.active) {
        this.modelingStore.setActiveDb(this.databaseItem);
      }
    });

    panel.onDidDispose(() => {
      this.modelingStore.removeDb(this.databaseItem);
      // onDidDispose is called after the tab has been closed,
      // so we want to check if there are any others still open.
      void this.app.commands.execute(
        "setContext",
        "codeql.modelEditorOpen",
        this.isAModelEditorOpen(),
      );
    });

    await this.waitForPanelLoaded();

    void this.app.commands.execute(
      "setContext",
      "codeql.modelEditorOpen",
      true,
    );
  }

  private isAModelEditorOpen(): boolean {
    return window.tabGroups.all.some((tabGroup) =>
      tabGroup.tabs.some((tab) => this.isTabModelEditorView(tab)),
    );
  }

  private isTabModelEditorView(tab: Tab): boolean {
    if (!(tab.input instanceof TabInputWebview)) {
      return false;
    }

    // The viewType has a prefix, such as "mainThreadWebview-", but if the
    // suffix matches that should be enough to identify the view.
    return tab.input.viewType.endsWith("model-editor");
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    return {
      viewId: "model-editor",
      title: `Modeling ${getLanguageDisplayName(
        this.extensionPack.language,
      )} (${this.extensionPack.name})`,
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "model-editor",
      iconPath: {
        dark: Uri.joinPath(
          Uri.file(this.app.extensionPath),
          "media/dark/symbol-misc.svg",
        ),
        light: Uri.joinPath(
          Uri.file(this.app.extensionPath),
          "media/light/symbol-misc.svg",
        ),
      },
    };
  }

  protected onPanelDispose(): void {
    // Nothing to do
  }

  protected async onMessage(msg: FromModelEditorMessage): Promise<void> {
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
      case "refreshMethods":
        await withProgress((progress) => this.loadMethods(progress), {
          cancellable: false,
        });

        void telemetryListener?.sendUIInteraction(
          "model-editor-refresh-methods",
        );

        break;
      case "jumpToMethod":
        await this.handleJumpToMethod(msg.methodSignature);
        void telemetryListener?.sendUIInteraction(
          "model-editor-jump-to-method",
        );

        break;
      case "saveModeledMethods":
        {
          const methods = this.modelingStore.getMethods(
            this.databaseItem,
            msg.methodSignatures,
          );
          const modeledMethods = this.modelingStore.getModeledMethods(
            this.databaseItem,
            msg.methodSignatures,
          );
          const mode = this.modelingStore.getMode(this.databaseItem);

          await withProgress(
            async (progress) => {
              progress({
                step: 1,
                maxStep: 500 + externalApiQueriesProgressMaxStep,
                message: "Writing model files",
              });
              await saveModeledMethods(
                this.extensionPack,
                this.language,
                methods,
                modeledMethods,
                mode,
                this.cliServer,
                this.app.logger,
              );

              await Promise.all([
                this.setViewState(),
                this.loadMethods((update) =>
                  progress({
                    ...update,
                    step: update.step + 500,
                    maxStep: 500 + externalApiQueriesProgressMaxStep,
                  }),
                ),
              ]);
            },
            {
              cancellable: false,
            },
          );

          this.modelingStore.removeModifiedMethods(
            this.databaseItem,
            Object.keys(modeledMethods),
          );

          this.modelingStore.updateMethodSorting(this.databaseItem);

          void telemetryListener?.sendUIInteraction(
            "model-editor-save-modeled-methods",
          );
        }

        break;
      case "generateMethod":
        await this.generateModeledMethods();

        void telemetryListener?.sendUIInteraction(
          "model-editor-generate-modeled-methods",
        );

        break;
      case "modelDependency":
        await this.modelDependency();
        void telemetryListener?.sendUIInteraction(
          "model-editor-model-dependency",
        );
        break;
      case "switchMode":
        this.modelingStore.setMode(this.databaseItem, msg.mode);
        this.modelingStore.setMethods(this.databaseItem, []);
        await Promise.all([
          this.postMessage({
            t: "setMethods",
            methods: [],
          }),
          this.setViewState(),
          withProgress((progress) => this.loadMethods(progress), {
            cancellable: false,
          }),
          this.loadAccessPathSuggestions(),
        ]);
        void telemetryListener?.sendUIInteraction("model-editor-switch-modes");

        break;
      case "hideModeledMethods":
        this.modelingStore.setHideModeledMethods(
          this.databaseItem,
          msg.hideModeledMethods,
        );
        void telemetryListener?.sendUIInteraction(
          "model-editor-hide-modeled-methods",
        );
        break;
      case "setMultipleModeledMethods": {
        this.setModeledMethods(msg.methodSignature, msg.modeledMethods);
        break;
      }
      case "startModelEvaluation":
        await this.modelEvaluator.startEvaluation();
        break;
      case "stopModelEvaluation":
        await this.modelEvaluator.stopEvaluation();
        break;
      case "openModelAlertsView":
        await this.modelEvaluator.openModelAlertsView();
        break;
      case "revealInModelAlertsView":
        await this.modelEvaluator.revealInModelAlertsView(msg.modeledMethod);
        break;
      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          this.app.logger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in model editor view: ${msg.error.message}`,
        );
        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await Promise.all([
      this.setViewState(),
      withProgress((progress, token) => this.loadMethods(progress, token), {
        cancellable: true,
      }).then(async () => {
        await this.generateModeledMethodsOnStartup();
      }),
      this.loadExistingModeledMethods(),
      this.loadAccessPathSuggestions(),
    ]);
  }

  public get databaseUri(): string {
    return this.databaseItem.databaseUri.toString();
  }

  public async focusView(): Promise<void> {
    this.panel?.reveal();
  }

  public async revealMethod(method: MethodSignature): Promise<void> {
    this.panel?.reveal();

    await this.postMessage({
      t: "revealMethod",
      methodSignature: method.signature,
    });
  }

  private async setViewState(): Promise<void> {
    const modelsAsDataLanguage = getModelsAsDataLanguage(this.language);

    const showGenerateButton =
      (this.databaseItem.language === "ruby" ||
        this.modelConfig.flowGeneration) &&
      !!modelsAsDataLanguage.modelGeneration;

    const showEvaluationUi = this.modelConfig.modelEvaluation;

    const sourceArchiveAvailable =
      this.databaseItem.hasSourceArchiveInExplorer();

    const showModeSwitchButton =
      this.languageDefinition.availableModes === undefined ||
      this.languageDefinition.availableModes.length > 1;

    await this.postMessage({
      t: "setModelEditorViewState",
      viewState: {
        extensionPack: this.extensionPack,
        language: this.language,
        showGenerateButton,
        showEvaluationUi,
        mode: this.modelingStore.getMode(this.databaseItem),
        showModeSwitchButton,
        sourceArchiveAvailable,
        modelConfig: createModelConfig(this.modelConfig),
      },
    });
  }

  protected async handleJumpToMethod(methodSignature: string) {
    const method = this.modelingStore.getMethod(
      this.databaseItem,
      methodSignature,
    );
    if (method) {
      this.modelingStore.setSelectedMethod(
        this.databaseItem,
        method,
        method.usages[0],
      );
    }
  }

  protected async loadExistingModeledMethods(): Promise<void> {
    try {
      const modeledMethods = await loadModeledMethods(
        this.extensionPack,
        this.language,
        this.cliServer,
        this.app.logger,
      );
      this.modelingStore.setModeledMethods(this.databaseItem, modeledMethods);
    } catch (e: unknown) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Unable to read data extension YAML: ${getErrorMessage(e)}`,
      );
    }
  }

  protected async loadMethods(
    progress: ProgressCallback,
    token?: CancellationToken,
  ): Promise<void> {
    const mode = this.modelingStore.getMode(this.databaseItem);

    try {
      if (!token) {
        token = this.cancellationTokenSource.token;
      }
      const queryResult = await runModelEditorQueries(mode, {
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        logger: this.app.logger,
        databaseItem: this.databaseItem,
        language: this.language,
        queryStorageDir: this.queryStorageDir,
        queryDir: this.queryDir,
        progress: (update) =>
          progress({
            ...update,
            message: `Loading models: ${update.message}`,
          }),
        token,
      });
      if (!queryResult) {
        return;
      }

      if (token.isCancellationRequested) {
        throw new UserCancellationException(
          "Model editor: Load methods cancelled.",
          true,
        );
      }

      this.modelingStore.setMethods(this.databaseItem, queryResult);
    } catch (err) {
      if (
        err instanceof ResponseError &&
        err.code === LSPErrorCodes.RequestCancelled
      ) {
        this.panel?.dispose();
        return;
      }

      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError(asError(err))`Failed to load results: ${getErrorMessage(
          err,
        )}`,
      );
    }
  }

  protected async loadAccessPathSuggestions(): Promise<void> {
    const mode = this.modelingStore.getMode(this.databaseItem);

    const modelsAsDataLanguage = getModelsAsDataLanguage(this.language);
    const accessPathSuggestions = modelsAsDataLanguage.accessPathSuggestions;
    if (!accessPathSuggestions) {
      return;
    }

    await withProgress(
      async (progress) => {
        try {
          const suggestions = await runSuggestionsQuery(mode, {
            parseResults: (results) =>
              accessPathSuggestions.parseResults(
                results,
                modelsAsDataLanguage,
                this.app.logger,
              ),
            queryConstraints: accessPathSuggestions.queryConstraints(mode),
            cliServer: this.cliServer,
            queryRunner: this.queryRunner,
            queryStorageDir: this.queryStorageDir,
            databaseItem: this.databaseItem,
            progress,
            token: this.cancellationTokenSource.token,
            logger: this.app.logger,
          });

          if (!suggestions) {
            return;
          }

          const options: AccessPathSuggestionOptions = {
            input: parseAccessPathSuggestionRowsToOptions(suggestions.input),
            output: parseAccessPathSuggestionRowsToOptions(suggestions.output),
          };

          await this.postMessage({
            t: "setAccessPathSuggestions",
            accessPathSuggestions: options,
          });
        } catch (e: unknown) {
          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(e),
            )`Failed to fetch access path suggestions: ${getErrorMessage(e)}`,
          );
        }
      },
      {
        cancellable: false,
        location: ProgressLocation.Window,
        title: "Loading access path suggestions",
      },
    );
  }

  protected async generateModeledMethods(): Promise<void> {
    await withProgress(
      async (progress) => {
        const mode = this.modelingStore.getMode(this.databaseItem);

        const modelsAsDataLanguage = getModelsAsDataLanguage(this.language);
        const modelGeneration = modelsAsDataLanguage.modelGeneration;
        if (!modelGeneration) {
          void showAndLogErrorMessage(
            this.app.logger,
            `Model generation is not supported for ${this.language}.`,
          );
          return;
        }

        let addedDatabase: DatabaseItem | undefined;

        // In application mode, we need the database of a specific library to generate
        // the modeled methods. In framework mode, we'll use the current database.
        if (mode === Mode.Application) {
          addedDatabase =
            await this.promptChooseNewOrExistingDatabase(progress);
          if (!addedDatabase) {
            return;
          }

          if (addedDatabase.language !== this.language) {
            void showAndLogErrorMessage(
              this.app.logger,
              `The selected database is for ${addedDatabase.language}, but the current database is for ${this.language}.`,
            );
            return;
          }
        }

        progress({
          step: 0,
          maxStep: 4000,
          message: "Generating modeled methods for library",
        });

        try {
          await runGenerateQueries({
            queryConstraints: modelGeneration.queryConstraints(mode),
            filterQueries: modelGeneration.filterQueries,
            onResults: async (queryPath, results) => {
              const modeledMethods = modelGeneration.parseResults(
                queryPath,
                results,
                modelsAsDataLanguage,
                this.app.logger,
                {
                  mode,
                  config: this.modelConfig,
                },
              );

              this.addModeledMethodsFromArray(modeledMethods);
            },
            cliServer: this.cliServer,
            queryRunner: this.queryRunner,
            queryStorageDir: this.queryStorageDir,
            databaseItem: addedDatabase ?? this.databaseItem,
            progress,
            token: this.cancellationTokenSource.token,
          });
        } catch (e: unknown) {
          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(e),
            )`Failed to generate models: ${getErrorMessage(e)}`,
          );
        }
      },
      { cancellable: false },
    );
  }

  protected async generateModeledMethodsOnStartup(): Promise<void> {
    const mode = this.modelingStore.getMode(this.databaseItem);
    const modelsAsDataLanguage = getModelsAsDataLanguage(this.language);
    const autoModelGeneration = modelsAsDataLanguage.autoModelGeneration;

    if (autoModelGeneration === undefined) {
      return;
    }

    const autoModelType = autoModelGeneration.type({
      mode,
      config: this.modelConfig,
    });

    if (autoModelType === AutoModelGenerationType.Disabled) {
      return;
    }

    await withProgress(
      async (progress) => {
        progress({
          step: 0,
          maxStep: 4000,
          message: "Generating models",
        });

        const extensionFile: ModelExtensionFile = {
          extensions: [],
        };

        try {
          await runGenerateQueries({
            queryConstraints: autoModelGeneration.queryConstraints(mode),
            filterQueries: autoModelGeneration.filterQueries,
            onResults: (queryPath, results) => {
              switch (autoModelType) {
                case AutoModelGenerationType.SeparateFile: {
                  const extensions = autoModelGeneration.parseResultsToYaml(
                    queryPath,
                    results,
                    modelsAsDataLanguage,
                    this.app.logger,
                  );

                  extensionFile.extensions.push(...extensions);
                  break;
                }
                case AutoModelGenerationType.Models: {
                  const modeledMethods = autoModelGeneration.parseResults(
                    queryPath,
                    results,
                    modelsAsDataLanguage,
                    this.app.logger,
                    {
                      mode,
                      config: this.modelConfig,
                    },
                  );

                  this.addModeledMethodsFromArray(modeledMethods);
                  break;
                }
                default: {
                  assertNever(autoModelType);
                }
              }
            },
            cliServer: this.cliServer,
            queryRunner: this.queryRunner,
            queryStorageDir: this.queryStorageDir,
            databaseItem: this.databaseItem,
            progress,
            token: this.cancellationTokenSource.token,
          });
        } catch (e: unknown) {
          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(e),
            )`Failed to auto-run generating models: ${getErrorMessage(e)}`,
          );
          return;
        }

        if (autoModelType === AutoModelGenerationType.SeparateFile) {
          progress({
            step: 4000,
            maxStep: 4000,
            message: "Saving generated models",
          });

          const fileContents = `# This file was automatically generated from ${this.databaseItem.name}. Manual changes will not persist.\n\n${modelExtensionFileToYaml(extensionFile)}`;
          const filePath = join(
            this.extensionPack.path,
            "models",
            `${this.language}${GENERATED_MODELS_SUFFIX}`,
          );

          await outputFile(filePath, fileContents);

          void this.app.logger.log(`Saved generated model file to ${filePath}`);
        }
      },
      {
        cancellable: false,
        location: ProgressLocation.Window,
        title: "Generating models",
      },
    );
  }

  private async modelDependency(): Promise<void> {
    return withProgress(
      async (progress, token) => {
        const addedDatabase =
          await this.promptChooseNewOrExistingDatabase(progress);
        if (!addedDatabase || token.isCancellationRequested) {
          return;
        }

        const addedDbUri = addedDatabase.databaseUri.toString();
        if (this.modelingStore.isDbOpen(addedDbUri)) {
          this.modelingEvents.fireFocusModelEditorEvent(addedDbUri);
          return;
        }

        const modelFile = await pickExtensionPack(
          this.cliServer,
          addedDatabase,
          this.modelConfig,
          this.app.logger,
          progress,
          token,
          3,
        );
        if (!modelFile) {
          return;
        }

        // Check again just before opening the editor to ensure no model editor has been opened between
        // our first check and now.
        if (this.modelingStore.isDbOpen(addedDbUri)) {
          this.modelingEvents.fireFocusModelEditorEvent(addedDbUri);
          return;
        }

        const view = new ModelEditorView(
          this.app,
          this.modelingStore,
          this.modelingEvents,
          this.modelConfig,
          this.databaseManager,
          this.databaseFetcher,
          this.variantAnalysisManager,
          this.cliServer,
          this.queryRunner,
          this.queryStorageDir,
          this.queryDir,
          addedDatabase,
          modelFile,
          this.language,
          Mode.Framework,
        );
        await view.openView();
      },
      { cancellable: true },
    );
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
    const addedDatabase = await this.databaseFetcher.promptImportGithubDatabase(
      progress,
      this.databaseItem.language,
      undefined,
      makeSelected,
      false,
    );
    if (!addedDatabase) {
      void this.app.logger.log("No database chosen");
      return;
    }

    return addedDatabase;
  }

  private registerToModelingEvents() {
    this.push(
      this.modelingEvents.onMethodsChanged(async (event) => {
        if (event.dbUri === this.databaseItem.databaseUri.toString()) {
          await this.postMessage({
            t: "setMethods",
            methods: event.methods,
          });
        }
      }),
    );

    this.push(
      this.modelingEvents.onModeledAndModifiedMethodsChanged(async (event) => {
        if (event.dbUri === this.databaseItem.databaseUri.toString()) {
          await this.postMessage({
            t: "setModeledAndModifiedMethods",
            methods: event.modeledMethods,
            modifiedMethodSignatures: [...event.modifiedMethodSignatures],
          });
        }
      }),
    );

    this.push(
      this.modelingEvents.onRevealInModelEditor(async (event) => {
        if (event.dbUri === this.databaseItem.databaseUri.toString()) {
          await this.revealMethod(event.method);
        }
      }),
    );

    this.push(
      this.modelingEvents.onFocusModelEditor(async (event) => {
        if (event.dbUri === this.databaseItem.databaseUri.toString()) {
          await this.focusView();
        }
      }),
    );
  }

  private registerToModelConfigEvents() {
    this.push(
      this.modelConfig.onDidChangeConfiguration(() => {
        void this.setViewState();
      }),
    );
  }

  private addModeledMethods(modeledMethods: Record<string, ModeledMethod[]>) {
    this.modelingStore.addModeledMethods(
      this.databaseItem,
      modeledMethods,
      true,
    );
  }

  private addModeledMethodsFromArray(modeledMethods: ModeledMethod[]) {
    const modeledMethodsByName: Record<string, ModeledMethod[]> = {};

    for (const modeledMethod of modeledMethods) {
      if (!(modeledMethod.signature in modeledMethodsByName)) {
        modeledMethodsByName[modeledMethod.signature] = [];
      }

      modeledMethodsByName[modeledMethod.signature].push(modeledMethod);
    }

    this.addModeledMethods(modeledMethodsByName);
  }

  private setModeledMethods(signature: string, methods: ModeledMethod[]) {
    this.modelingStore.updateModeledMethods(
      this.databaseItem,
      signature,
      methods,
      true,
    );
  }

  private async updateModelEvaluationRun(run: ModelEvaluationRunState) {
    await this.postMessage({
      t: "setModelEvaluationRun",
      run,
    });
  }
}
