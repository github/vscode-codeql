import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import {
  FromModelEditorMessage,
  ToModelEditorMessage,
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
import { runFlowModelQueries } from "./flow-model-queries";
import { promptImportGithubDatabase } from "../databases/database-fetcher";
import { App } from "../common/app";
import { showResolvableLocation } from "../databases/local-databases/locations";
import { redactableError } from "../common/errors";
import {
  externalApiQueriesProgressMaxStep,
  runExternalApiQueries,
} from "./external-api-usage-queries";
import { Method, Usage } from "./method";
import { ModeledMethod } from "./modeled-method";
import { ExtensionPack } from "./shared/extension-pack";
import { showFlowGeneration, showLlmGeneration } from "../config";
import { Mode } from "./shared/mode";
import { loadModeledMethods, saveModeledMethods } from "./modeled-method-fs";
import { join } from "path";
import { pickExtensionPack } from "./extension-pack-picker";
import { getLanguageDisplayName } from "../common/query-language";
import { AutoModeler } from "./auto-modeler";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";
import { telemetryListener } from "../common/vscode/telemetry";

export class ModelEditorView extends AbstractWebview<
  ToModelEditorMessage,
  FromModelEditorMessage
> {
  private readonly autoModeler: AutoModeler;

  private methods: Method[];
  private hideModeledMethods: boolean;

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
    private readonly updateMethodsUsagePanelState: (
      methods: Method[],
      databaseItem: DatabaseItem,
      hideModeledMethods: boolean,
    ) => Promise<void>,
    private readonly showMethod: (
      method: Method,
      usage: Usage,
    ) => Promise<void>,
    private readonly handleViewBecameActive: (view: ModelEditorView) => void,
    private readonly handleViewWasDisposed: (view: ModelEditorView) => void,
    private readonly isMostRecentlyActiveView: (
      view: ModelEditorView,
    ) => boolean,
  ) {
    super(ctx);

    this.autoModeler = new AutoModeler(
      app,
      cliServer,
      queryRunner,
      queryStorageDir,
      databaseItem,
      async (packageName, inProgressMethods) => {
        await this.postMessage({
          t: "setInProgressMethods",
          packageName,
          inProgressMethods,
        });
      },
      async (modeledMethods) => {
        await this.postMessage({ t: "addModeledMethods", modeledMethods });
      },
    );
    this.methods = [];
    this.hideModeledMethods = INITIAL_HIDE_MODELED_METHODS_VALUE;
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    panel.onDidChangeViewState(async () => {
      if (panel.active) {
        this.handleViewBecameActive(this);
        await this.updateMethodsUsagePanelState(
          this.methods,
          this.databaseItem,
          this.hideModeledMethods,
        );
      }
    });

    panel.onDidDispose(() => {
      this.handleViewWasDisposed(this);
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
      tabGroup.tabs.some((tab) => {
        const viewType: string | undefined = (tab.input as any)?.viewType;
        // The viewType has a prefix, such as "mainThreadWebview-", but if the
        // suffix matches that should be enough to identify the view.
        return viewType && viewType.endsWith("model-editor");
      }),
    );
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
        await withProgress((progress) => this.loadExternalApiUsages(progress), {
          cancellable: false,
        });

        void telemetryListener?.sendUIInteraction(
          "model-editor-refresh-methods",
        );

        break;
      case "jumpToUsage":
        await this.handleJumpToUsage(msg.method, msg.usage);
        void telemetryListener?.sendUIInteraction("model-editor-jump-to-usage");

        break;
      case "saveModeledMethods":
        await withProgress(
          async (progress) => {
            progress({
              step: 1,
              maxStep: 500 + externalApiQueriesProgressMaxStep,
              message: "Writing model files",
            });
            await saveModeledMethods(
              this.extensionPack,
              this.databaseItem.language,
              msg.methods,
              msg.modeledMethods,
              this.mode,
              this.cliServer,
              this.app.logger,
            );

            await Promise.all([
              this.setViewState(),
              this.loadExternalApiUsages((update) =>
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
        void telemetryListener?.sendUIInteraction(
          "model-editor-save-modeled-methods",
        );

        break;
      case "generateMethod":
        await this.generateModeledMethods();
        void telemetryListener?.sendUIInteraction(
          "model-editor-generate-modeled-methods",
        );

        break;
      case "generateMethodsFromLlm":
        await this.generateModeledMethodsFromLlm(
          msg.packageName,
          msg.methods,
          msg.modeledMethods,
        );
        void telemetryListener?.sendUIInteraction(
          "model-editor-generate-methods-from-llm",
        );
        break;
      case "stopGeneratingMethodsFromLlm":
        await this.autoModeler.stopModeling(msg.packageName);
        void telemetryListener?.sendUIInteraction(
          "model-editor-stop-generating-methods-from-llm",
        );
        break;
      case "modelDependency":
        await this.modelDependency();
        void telemetryListener?.sendUIInteraction(
          "model-editor-model-dependency",
        );
        break;
      case "switchMode":
        this.mode = msg.mode;
        this.methods = [];
        await Promise.all([
          this.postMessage({
            t: "setMethods",
            methods: this.methods,
          }),
          this.setViewState(),
          withProgress((progress) => this.loadExternalApiUsages(progress), {
            cancellable: false,
          }),
        ]);
        void telemetryListener?.sendUIInteraction("model-editor-switch-modes");

        break;
      case "hideModeledMethods":
        this.hideModeledMethods = msg.hideModeledMethods;
        await this.updateMethodsUsagePanelState(
          this.methods,
          this.databaseItem,
          this.hideModeledMethods,
        );
        void telemetryListener?.sendUIInteraction(
          "model-editor-hide-modeled-methods",
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
      withProgress((progress) => this.loadExternalApiUsages(progress), {
        cancellable: false,
      }),
      this.loadExistingModeledMethods(),
    ]);
  }

  private async setViewState(): Promise<void> {
    const showLlmButton =
      this.databaseItem.language === "java" && showLlmGeneration();

    await this.postMessage({
      t: "setModelEditorViewState",
      viewState: {
        extensionPack: this.extensionPack,
        showFlowGeneration: showFlowGeneration(),
        showLlmButton,
        mode: this.mode,
      },
    });
  }

  protected async handleJumpToUsage(method: Method, usage: Usage) {
    await this.showMethod(method, usage);
    await showResolvableLocation(usage.url, this.databaseItem, this.app.logger);
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

  protected async loadExternalApiUsages(
    progress: ProgressCallback,
  ): Promise<void> {
    try {
      const cancellationTokenSource = new CancellationTokenSource();
      const queryResult = await runExternalApiQueries(this.mode, {
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        databaseItem: this.databaseItem,
        queryStorageDir: this.queryStorageDir,
        queryDir: this.queryDir,
        progress: (update) =>
          progress({
            ...update,
            message: `Loading models: ${update.message}`,
          }),
        token: cancellationTokenSource.token,
      });
      if (!queryResult) {
        return;
      }
      this.methods = queryResult;

      await this.postMessage({
        t: "setMethods",
        methods: this.methods,
      });
      if (this.isMostRecentlyActiveView(this)) {
        await this.updateMethodsUsagePanelState(
          this.methods,
          this.databaseItem,
          this.hideModeledMethods,
        );
      }
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
          await runFlowModelQueries({
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

  private async generateModeledMethodsFromLlm(
    packageName: string,
    methods: Method[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    await this.autoModeler.startModeling(
      packageName,
      methods,
      modeledMethods,
      this.mode,
    );
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
        3,
      );
      if (!modelFile) {
        return;
      }

      const view = new ModelEditorView(
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
        this.updateMethodsUsagePanelState,
        this.showMethod,
        this.handleViewBecameActive,
        this.handleViewWasDisposed,
        this.isMostRecentlyActiveView,
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
      false,
    );
    if (!addedDatabase) {
      void this.app.logger.log("No database chosen");
      return;
    }

    return addedDatabase;
  }
}
