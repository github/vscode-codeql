import { window } from "vscode";
import type { App } from "../common/app";
import { extLogger } from "../common/logging/vscode";
import { DisposableObject } from "../common/disposable-object";
import { DbConfigStore } from "./config/db-config-store";
import { DbManager } from "./db-manager";
import { DbPanel } from "./ui/db-panel";
import { DbSelectionDecorationProvider } from "./ui/db-selection-decoration-provider";
import type { DatabasePanelCommands } from "../common/commands";
import { VariantAnalysisConfigListener } from "../config";

export class DbModule extends DisposableObject {
  public readonly dbManager: DbManager;
  private readonly dbConfigStore: DbConfigStore;
  private dbPanel: DbPanel | undefined;

  private constructor(app: App) {
    super();

    this.dbConfigStore = new DbConfigStore(app);
    this.dbManager = this.push(
      new DbManager(
        app,
        this.dbConfigStore,
        new VariantAnalysisConfigListener(),
      ),
    );
  }

  public static async initialize(app: App): Promise<DbModule> {
    const dbModule = new DbModule(app);
    app.subscriptions.push(dbModule);

    await dbModule.initialize(app);
    return dbModule;
  }

  public getCommands(): DatabasePanelCommands {
    if (!this.dbPanel) {
      throw new Error("Database panel not initialized");
    }

    return {
      ...this.dbPanel.getCommands(),
    };
  }

  private async initialize(app: App): Promise<void> {
    void extLogger.log("Initializing database module");

    await this.dbConfigStore.initialize();

    this.dbPanel = new DbPanel(app, this.dbManager);

    this.push(this.dbPanel);
    this.push(this.dbConfigStore);

    const dbSelectionDecorationProvider = new DbSelectionDecorationProvider();

    window.registerFileDecorationProvider(dbSelectionDecorationProvider);
  }
}
