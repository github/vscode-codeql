import { ExtensionContext } from "vscode";
import { DataExtensionsEditorView } from "./data-extensions-editor-view";
import { DataExtensionsEditorCommands } from "../common/commands";
import { CliVersionConstraint, CodeQLCliServer } from "../cli";
import { QueryRunner } from "../queryRunner";
import { DatabaseManager } from "../local-databases";
import { ensureDir } from "fs-extra";
import { join } from "path";
import { App } from "../common/app";
import { showAndLogErrorMessage } from "../helpers";
import { withProgress } from "../progress";
import { pickExtensionPackModelFile } from "./extension-pack-picker";

export class DataExtensionsEditorModule {
  private readonly queryStorageDir: string;

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
      "codeQL.openDataExtensionsEditor": async () =>
        withProgress(
          async (progress) => {
            const db = this.databaseManager.currentDatabaseItem;
            if (!db) {
              void showAndLogErrorMessage("No database selected");
              return;
            }

            if (!(await this.cliServer.cliConstraints.supportsQlpacksKind())) {
              void showAndLogErrorMessage(
                `This feature requires CodeQL CLI version ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND.format()} or later.`,
              );
              return;
            }

            const modelFile = await pickExtensionPackModelFile(
              this.cliServer,
              progress,
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
        ),
    };
  }

  private async initialize(): Promise<void> {
    await ensureDir(this.queryStorageDir);
  }
}
