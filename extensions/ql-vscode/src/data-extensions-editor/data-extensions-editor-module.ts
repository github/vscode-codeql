import { ExtensionContext } from "vscode";
import { DataExtensionsEditorView } from "./data-extensions-editor-view";
import { ExternalApiCommands } from "../common/commands";
import { DatabaseManager } from "../local-databases";
import { CodeQLCliServer } from "../cli";
import { QueryRunner } from "../queryRunner";
import { App } from "../common/app";
import { extLogger } from "../common";

export class DataExtensionsEditorModule {
  public constructor(
    private readonly ctx: ExtensionContext,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
  ) {}

  public getCommands(): ExternalApiCommands {
    return {
      "codeQL.openExternalApi": async () => {
        const db = this.databaseManager.currentDatabaseItem;
        if (!db) {
          void extLogger.log("No database selected");
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
        );
        await view.openView();
      },
    };
  }
}
