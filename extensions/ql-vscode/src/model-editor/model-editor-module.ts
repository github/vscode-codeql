import { ExtensionContext } from "vscode";
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
import { Mode } from "./shared/mode";
import { showResolvableLocation } from "../databases/local-databases/locations";
import { ExternalApiUsage, Usage } from "./external-api-usage";
import { setUpPack } from "./model-editor-queries";
import { MethodModelingPanel } from "./method-modeling/method-modeling-panel";

const SUPPORTED_LANGUAGES: string[] = ["java", "csharp"];

export class ModelEditorModule extends DisposableObject {
  private readonly queryStorageDir: string;
  private readonly methodsUsagePanel: MethodsUsagePanel;
  private readonly methodModelingPanel: MethodModelingPanel;

  private mostRecentlyActiveView: ModelEditorView | undefined = undefined;

  private constructor(
    private readonly ctx: ExtensionContext,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    baseQueryStorageDir: string,
  ) {
    super();
    this.queryStorageDir = join(baseQueryStorageDir, "model-editor-results");
    this.methodsUsagePanel = this.push(new MethodsUsagePanel(cliServer));
    this.methodModelingPanel = this.push(new MethodModelingPanel(ctx));
  }

  private handleViewBecameActive(view: ModelEditorView): void {
    this.mostRecentlyActiveView = view;
  }

  private handleViewWasDisposed(view: ModelEditorView): void {
    if (this.mostRecentlyActiveView === view) {
      this.mostRecentlyActiveView = undefined;
    }
  }

  private isMostRecentlyActiveView(view: ModelEditorView): boolean {
    return this.mostRecentlyActiveView === view;
  }

  public static async initialize(
    ctx: ExtensionContext,
    app: App,
    databaseManager: DatabaseManager,
    cliServer: CodeQLCliServer,
    queryRunner: QueryRunner,
    queryStorageDir: string,
  ): Promise<ModelEditorModule> {
    const modelEditorModule = new ModelEditorModule(
      ctx,
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
      "codeQL.openModelEditor": async () => {
        const db = this.databaseManager.currentDatabaseItem;
        if (!db) {
          void showAndLogErrorMessage(this.app.logger, "No database selected");
          return;
        }

        const language = db.language;
        if (
          !SUPPORTED_LANGUAGES.includes(language) ||
          !isQueryLanguage(language)
        ) {
          void showAndLogErrorMessage(
            this.app.logger,
            `The CodeQL Model Editor is not supported for ${language} databases.`,
          );
          return;
        }

        return withProgress(
          async (progress, token) => {
            if (!(await this.cliServer.cliConstraints.supportsQlpacksKind())) {
              void showAndLogErrorMessage(
                this.app.logger,
                `This feature requires CodeQL CLI version ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND.format()} or later.`,
              );
              return;
            }

            if (
              !(await this.cliServer.cliConstraints.supportsResolveExtensions())
            ) {
              void showAndLogErrorMessage(
                this.app.logger,
                `This feature requires CodeQL CLI version ${CliVersionConstraint.CLI_VERSION_WITH_RESOLVE_EXTENSIONS.format()} or later.`,
              );
              return;
            }

            const modelFile = await pickExtensionPack(
              this.cliServer,
              db,
              this.app.logger,
              progress,
              token,
            );
            if (!modelFile) {
              return;
            }

            // Create new temporary directory for query files and pack dependencies
            const queryDir = (await dir({ unsafeCleanup: true })).path;
            const success = await setUpPack(this.cliServer, queryDir, language);
            if (!success) {
              return;
            }

            const view = new ModelEditorView(
              this.ctx,
              this.app,
              this.databaseManager,
              this.cliServer,
              this.queryRunner,
              this.queryStorageDir,
              queryDir,
              db,
              modelFile,
              Mode.Application,
              this.methodsUsagePanel.setState.bind(this.methodsUsagePanel),
              this.showMethod.bind(this),
              this.handleViewBecameActive.bind(this),
              this.handleViewWasDisposed.bind(this),
              this.isMostRecentlyActiveView.bind(this),
            );
            await view.openView();
          },
          {
            title: "Opening CodeQL Model Editor",
          },
        );
      },
      "codeQLModelEditor.jumpToUsageLocation": async (
        usage: Usage,
        databaseItem: DatabaseItem,
      ) => {
        await showResolvableLocation(usage.url, databaseItem, this.app.logger);
      },
    };
  }

  private async initialize(): Promise<void> {
    await ensureDir(this.queryStorageDir);
  }

  private async showMethod(usage: Usage): Promise<void> {
    await this.methodsUsagePanel.revealItem(usage);

    // For now, just construct a dummy method and show it in the method modeling panel
    // because the method isn't easily accessible yet.
    const method: ExternalApiUsage = {
      library: "sql2o",
      libraryVersion: "1.6.0",
      signature: "org.sql2o.Connection#createQuery(String)",
      packageName: "org.sql2o",
      typeName: "Connection",
      methodName: "createQuery",
      methodParameters: "(String)",
      supported: true,
      supportedType: "summary",
      usages: [],
    };
    await this.methodModelingPanel.setMethod(method);
  }
}
