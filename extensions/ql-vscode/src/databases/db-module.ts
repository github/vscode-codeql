import { window } from "vscode";
import { App, AppMode } from "../common/app";
import { extLogger } from "../common";
import { DisposableObject } from "../pure/disposable-object";
import { DbConfigStore } from "./config/db-config-store";
import { DbManager } from "./db-manager";
import { DbPanel } from "./ui/db-panel";
import { DbSelectionDecorationProvider } from "./ui/db-selection-decoration-provider";
import { isCanary, isNewQueryRunExperienceEnabled } from "../config";

export class DbModule extends DisposableObject {
  public readonly dbManager: DbManager;
  private readonly dbConfigStore: DbConfigStore;

  private constructor(app: App) {
    super();

    this.dbConfigStore = new DbConfigStore(app);
    this.dbManager = new DbManager(app, this.dbConfigStore);
  }

  public static async initialize(app: App): Promise<DbModule | undefined> {
    if (DbModule.shouldEnableModule(app.mode)) {
      const dbModule = new DbModule(app);
      app.subscriptions.push(dbModule);

      await dbModule.initialize();
      return dbModule;
    }

    return undefined;
  }

  private static shouldEnableModule(app: AppMode): boolean {
    if (app === AppMode.Development || app === AppMode.Test) {
      return true;
    }

    return isCanary() && isNewQueryRunExperienceEnabled();
  }

  private async initialize(): Promise<void> {
    void extLogger.log("Initializing database module");

    await this.dbConfigStore.initialize();

    const dbPanel = new DbPanel(this.dbManager);
    await dbPanel.initialize();

    this.push(dbPanel);
    this.push(this.dbConfigStore);

    const dbSelectionDecorationProvider = new DbSelectionDecorationProvider();

    window.registerFileDecorationProvider(dbSelectionDecorationProvider);
  }
}
