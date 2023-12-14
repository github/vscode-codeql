import { ModelEditorView } from "./model-editor-view";
import { ModelEditorCommands } from "../common/commands";
import { CliVersionConstraint, CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import { ensureDir } from "fs-extra";
import { join } from "path";
import { App } from "../common/app";
import { withProgress } from "../common/vscode/progress";
import { pickExtensionPack } from "./extension-pack-picker";
import { showAndLogErrorMessage } from "../common/logging";
import { dir } from "tmp-promise";

import { isQueryLanguage } from "../common/query-language";
import { DisposableObject } from "../common/disposable-object";
import { MethodsUsagePanel } from "./methods-usage/methods-usage-panel";
import { Method, Usage } from "./method";
import { setUpPack } from "./model-editor-queries-setup";
import { MethodModelingPanel } from "./method-modeling/method-modeling-panel";
import { ModelingStore } from "./modeling-store";
import { showResolvableLocation } from "../databases/local-databases/locations";
import { ModelConfigListener } from "../config";
import { ModelingEvents } from "./modeling-events";
import { getModelsAsDataLanguage } from "./languages";
import { INITIAL_MODE } from "./shared/mode";
import { isSupportedLanguage } from "./supported-languages";
import { DefaultNotifier, checkConsistency } from "./consistency-check";

export class ModelEditorModule extends DisposableObject {
  private readonly queryStorageDir: string;
  private readonly modelingStore: ModelingStore;
  private readonly modelingEvents: ModelingEvents;
  private readonly methodsUsagePanel: MethodsUsagePanel;
  private readonly methodModelingPanel: MethodModelingPanel;
  private readonly modelConfig: ModelConfigListener;

  private constructor(
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    baseQueryStorageDir: string,
  ) {
    super();
    this.queryStorageDir = join(baseQueryStorageDir, "model-editor-results");
    this.modelingEvents = new ModelingEvents(app);
    this.modelingStore = new ModelingStore(this.modelingEvents);
    this.methodsUsagePanel = this.push(
      new MethodsUsagePanel(this.modelingStore, this.modelingEvents, cliServer),
    );
    this.methodModelingPanel = this.push(
      new MethodModelingPanel(app, this.modelingStore, this.modelingEvents),
    );
    this.modelConfig = this.push(new ModelConfigListener());

    this.registerToModelingEvents();
  }

  public static async initialize(
    app: App,
    databaseManager: DatabaseManager,
    cliServer: CodeQLCliServer,
    queryRunner: QueryRunner,
    queryStorageDir: string,
  ): Promise<ModelEditorModule> {
    const modelEditorModule = new ModelEditorModule(
      app,
      databaseManager,
      cliServer,
      queryRunner,
      queryStorageDir,
    );

    await modelEditorModule.initialize();
    return modelEditorModule;
  }

  public getCommands(): ModelEditorCommands {
    return {
      "codeQL.openModelEditor": this.openModelEditor.bind(this),
      "codeQL.openModelEditorFromModelingPanel":
        this.openModelEditor.bind(this),
      "codeQLModelEditor.jumpToMethod": async (
        method: Method,
        usage: Usage,
        databaseItem: DatabaseItem,
      ) => {
        this.modelingStore.setSelectedMethod(databaseItem, method, usage);
      },
    };
  }

  private async initialize(): Promise<void> {
    await ensureDir(this.queryStorageDir);
  }

  private registerToModelingEvents(): void {
    this.push(
      this.modelingEvents.onSelectedMethodChanged(async (event) => {
        await this.showMethod(event.databaseItem, event.method, event.usage);
      }),
    );

    this.push(
      this.modelingEvents.onMethodsChanged((event) => {
        if (!this.modelConfig.enableConsistencyCheck) {
          return;
        }

        const modeledMethods = this.modelingStore.getModeledMethods(
          event.databaseItem,
        );

        checkConsistency(
          event.methods,
          modeledMethods,
          new DefaultNotifier(this.app.logger),
        );
      }),
    );
  }

  private async showMethod(
    databaseItem: DatabaseItem,
    method: Method,
    usage: Usage,
  ): Promise<void> {
    await this.methodsUsagePanel.revealItem(method.signature, usage);
    await this.methodModelingPanel.setMethod(databaseItem, method);
    await showResolvableLocation(usage.url, databaseItem, this.app.logger);
  }

  private async openModelEditor(): Promise<void> {
    {
      const db = this.databaseManager.currentDatabaseItem;
      if (!db) {
        void showAndLogErrorMessage(this.app.logger, "No database selected");
        return;
      }

      const language = db.language;

      if (
        !isQueryLanguage(language) ||
        !isSupportedLanguage(language, this.modelConfig)
      ) {
        void showAndLogErrorMessage(
          this.app.logger,
          `The CodeQL Model Editor is not supported for ${language} databases.`,
        );
        return;
      }

      const definition = getModelsAsDataLanguage(language);

      const initialMode = definition.availableModes?.[0] ?? INITIAL_MODE;

      if (this.modelingStore.isDbOpen(db.databaseUri.toString())) {
        this.modelingEvents.fireFocusModelEditorEvent(
          db.databaseUri.toString(),
        );
        return;
      }

      return withProgress(
        async (progress) => {
          const maxStep = 4;

          if (!(await this.cliServer.cliConstraints.supportsQlpacksKind())) {
            void showAndLogErrorMessage(
              this.app.logger,
              `This feature requires CodeQL CLI version ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND.format()} or later.`,
            );
            return;
          }

          const modelFile = await pickExtensionPack(
            this.cliServer,
            db,
            this.modelConfig,
            this.app.logger,
            progress,
            maxStep,
          );
          if (!modelFile) {
            return;
          }

          progress({
            message: "Installing dependencies...",
            step: 3,
            maxStep,
          });

          // Create new temporary directory for query files and pack dependencies
          const { path: queryDir, cleanup: cleanupQueryDir } = await dir({
            unsafeCleanup: true,
          });

          const success = await setUpPack(
            this.cliServer,
            this.app.logger,
            queryDir,
            language,
            this.modelConfig,
          );
          if (!success) {
            await cleanupQueryDir();
            return;
          }

          progress({
            message: "Opening editor...",
            step: 4,
            maxStep,
          });

          // Check again just before opening the editor to ensure no model editor has been opened between
          // our first check and now.
          if (this.modelingStore.isDbOpen(db.databaseUri.toString())) {
            this.modelingEvents.fireFocusModelEditorEvent(
              db.databaseUri.toString(),
            );
            return;
          }

          const view = new ModelEditorView(
            this.app,
            this.modelingStore,
            this.modelingEvents,
            this.modelConfig,
            this.databaseManager,
            this.cliServer,
            this.queryRunner,
            this.queryStorageDir,
            queryDir,
            db,
            modelFile,
            language,
            initialMode,
          );

          this.modelingEvents.onDbClosed(async (dbUri) => {
            if (dbUri === db.databaseUri.toString()) {
              await cleanupQueryDir();
            }
          });

          this.push(view);
          this.push({
            dispose(): void {
              void cleanupQueryDir();
            },
          });

          await view.openView();
        },
        {
          title: "Opening CodeQL Model Editor",
        },
      );
    }
  }
}
