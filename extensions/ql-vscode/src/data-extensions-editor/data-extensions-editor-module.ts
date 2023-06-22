import { ExtensionContext } from "vscode";
import { DataExtensionsEditorView } from "./data-extensions-editor-view";
import {
  DataExtensionsEditorCommands,
  ModelingCommands,
} from "../common/commands";
import { CliVersionConstraint, CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseManager } from "../databases/local-databases";
import { ensureDir } from "fs-extra";
import { join } from "path";
import { App } from "../common/app";
import { withProgress } from "../common/vscode/progress";
import { pickExtensionPackModelFile } from "./extension-pack-picker";
import { showAndLogErrorMessage } from "../common/logging";
import { ModelingPanel } from "./panel/modeling-panel";

const SUPPORTED_LANGUAGES: string[] = ["java", "csharp"];

export class DataExtensionsEditorModule {
  private readonly queryStorageDir: string;
  private readonly modelingPanel: ModelingPanel;

  private constructor(
    private readonly ctx: ExtensionContext,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    baseQueryStorageDir: string,
  ) {
    this.queryStorageDir = join(
      baseQueryStorageDir,
      "data-extensions-editor-results",
    );

    this.modelingPanel = new ModelingPanel(
      app,
      databaseManager,
      cliServer,
      queryRunner,
      this.queryStorageDir,
    );
    ctx.subscriptions.push(this.modelingPanel);
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

  public getCommands(): DataExtensionsEditorCommands & ModelingCommands {
    return {
      ...this.modelingPanel.getCommands(),
      "codeQL.openDataExtensionsEditor": async () => {
        const db = this.databaseManager.currentDatabaseItem;
        if (!db) {
          void showAndLogErrorMessage(this.app.logger, "No database selected");
          return;
        }

        if (!SUPPORTED_LANGUAGES.includes(db.language)) {
          void showAndLogErrorMessage(
            this.app.logger,
            `The data extensions editor is not supported for ${db.language} databases.`,
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

            const modelFile = await pickExtensionPackModelFile(
              this.cliServer,
              db,
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
              db,
              modelFile,
            );
            await view.openView();
          },
          {
            title: "Opening Data Extensions Editor",
          },
        );
      },
    };
  }

  private async initialize(): Promise<void> {
    await ensureDir(this.queryStorageDir);
  }
}
