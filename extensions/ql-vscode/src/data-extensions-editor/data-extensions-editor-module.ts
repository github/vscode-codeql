import { ExtensionContext } from "vscode";
import { DataExtensionsEditorView } from "./data-extensions-editor-view";
import { DataExtensionsEditorCommands } from "../common/commands";
import { CliVersionConstraint, CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import { ensureDir } from "fs-extra";
import { join } from "path";
import { App } from "../common/app";
import { withProgress } from "../common/vscode/progress";
import { pickExtensionPack } from "./extension-pack-picker";
import {
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
} from "../common/logging";
import { dir } from "tmp-promise";
import { fetchExternalApiQueries } from "./queries";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { extLogger } from "../common/logging/vscode";
import { isQueryLanguage } from "../common/query-language";
import { setUpPack } from "./external-api-usage-query";
import { DisposableObject } from "../common/disposable-object";
import { ModelDetailsPanel } from "./model-details/model-details-panel";
import { Mode } from "./shared/mode";
import { showResolvableLocation } from "../databases/local-databases/locations";
import { Usage } from "./external-api-usage";

const SUPPORTED_LANGUAGES: string[] = ["java", "csharp"];

export class DataExtensionsEditorModule extends DisposableObject {
  private readonly queryStorageDir: string;
  private readonly modelDetailsPanel: ModelDetailsPanel;

  private constructor(
    private readonly ctx: ExtensionContext,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    baseQueryStorageDir: string,
  ) {
    super();
    this.queryStorageDir = join(
      baseQueryStorageDir,
      "data-extensions-editor-results",
    );
    this.modelDetailsPanel = this.push(new ModelDetailsPanel());
  }

  public static async initialize(
    ctx: ExtensionContext,
    app: App,
    databaseManager: DatabaseManager,
    cliServer: CodeQLCliServer,
    queryRunner: QueryRunner,
    queryStorageDir: string,
  ): Promise<DataExtensionsEditorModule> {
    const dataExtensionsEditorModule = new DataExtensionsEditorModule(
      ctx,
      app,
      databaseManager,
      cliServer,
      queryRunner,
      queryStorageDir,
    );

    await dataExtensionsEditorModule.initialize();
    return dataExtensionsEditorModule;
  }

  public getCommands(): DataExtensionsEditorCommands {
    return {
      "codeQL.openDataExtensionsEditor": async () => {
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
            `The data extensions editor is not supported for ${language} databases.`,
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

            const query = fetchExternalApiQueries[language];
            if (!query) {
              void showAndLogExceptionWithTelemetry(
                extLogger,
                telemetryListener,
                redactableError`No external API usage query found for language ${language}`,
              );
              return;
            }

            // Create new temporary directory for query files and pack dependencies
            const queryDir = (await dir({ unsafeCleanup: true })).path;
            await setUpPack(queryDir, query, language);
            await this.cliServer.packInstall(queryDir);

            const view = new DataExtensionsEditorView(
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
              this.modelDetailsPanel.setState.bind(this.modelDetailsPanel),
            );
            await view.openView();
          },
          {
            title: "Opening Data Extensions Editor",
          },
        );
      },
      "codeQLDataExtensionsEditor.jumpToUsageLocation": async (
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
}
