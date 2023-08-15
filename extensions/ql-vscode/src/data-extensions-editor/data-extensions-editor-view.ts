import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
} from "vscode";
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
import { showResolvableLocation } from "../databases/local-databases/locations";
import { decodeBqrsToExternalApiUsages } from "./bqrs";
import { redactableError } from "../common/errors";
import { readQueryResults, runQuery } from "./external-api-usage-query";
import { ExternalApiUsage, Usage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { ExtensionPack } from "./shared/extension-pack";
import {
  enableFrameworkMode,
  showLlmGeneration,
  showModelDetailsView,
} from "../config";
import { Mode } from "./shared/mode";
import { loadModeledMethods, saveModeledMethods } from "./modeled-method-fs";
import { join } from "path";
import { pickExtensionPack } from "./extension-pack-picker";
import { getLanguageDisplayName } from "../common/query-language";
import { AutoModeler } from "./auto-modeler";

export class DataExtensionsEditorView extends AbstractWebview<
  ToDataExtensionsEditorMessage,
  FromDataExtensionsEditorMessage
> {
  private static mostRecentlyActivePanel: WebviewPanel | undefined = undefined;

  private readonly autoModeler: AutoModeler;

  private externalApiUsages: ExternalApiUsage[];

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
    ) => Promise<void>,
    private readonly revealItemInDetailsPanel: (usage: Usage) => Promise<void>,
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
    this.externalApiUsages = [];
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    panel.onDidChangeViewState(async () => {
      if (panel.active) {
        await this.onPanelBecameActive();
        await this.updateModelDetailsPanelState(
          this.externalApiUsages,
          this.databaseItem,
        );
      }
    });

    panel.onDidDispose(async () => {
      await this.onPanelWasDisposed();
    });

    await this.waitForPanelLoaded();
  }

  private async onPanelBecameActive(): Promise<void> {
    const panel = await this.getPanel();
    DataExtensionsEditorView.mostRecentlyActivePanel = panel;
  }

  private async onPanelWasDisposed(): Promise<void> {
    const panel = await this.getPanel();
    if (panel === DataExtensionsEditorView.mostRecentlyActivePanel) {
      DataExtensionsEditorView.mostRecentlyActivePanel = undefined;
    }
  }

  private async isTheMostRecentlyActivePanel(): Promise<boolean> {
    const panel = await this.getPanel();
    return panel === DataExtensionsEditorView.mostRecentlyActivePanel;
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
        await this.handleJumpToUsage(msg.usage);

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
        await this.generateModeledMethodsFromLlm(
          msg.packageName,
          msg.externalApiUsages,
          msg.modeledMethods,
        );
        break;
      case "stopGeneratingExternalApiFromLlm":
        await this.autoModeler.stopModeling(msg.packageName);
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

  protected async handleJumpToUsage(usage: Usage) {
    if (showModelDetailsView()) {
      await this.revealItemInDetailsPanel(usage);
    }
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

          this.externalApiUsages = decodeBqrsToExternalApiUsages(bqrsChunk);

          await this.postMessage({
            t: "setExternalApiUsages",
            externalApiUsages: this.externalApiUsages,
          });
          if (await this.isTheMostRecentlyActivePanel()) {
            await this.updateModelDetailsPanelState(
              this.externalApiUsages,
              this.databaseItem,
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

  private async generateModeledMethodsFromLlm(
    packageName: string,
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ): Promise<void> {
    await this.autoModeler.startModeling(
      packageName,
      externalApiUsages,
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
        this.revealItemInDetailsPanel,
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
}
