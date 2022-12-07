import { window } from "vscode";
import { App, AppMode } from "../common/app";
import { isCanary, isNewQueryRunExperienceEnabled } from "../config";
import { extLogger } from "../common";
import { DisposableObject } from "../pure/disposable-object";
import { DbConfigStore } from "./config/db-config-store";
import { DbManager } from "./db-manager";
import { DbPanel } from "./ui/db-panel";
import { DbSelectionDecorationProvider } from "./ui/db-selection-decoration-provider";

export class DbModule extends DisposableObject {
  public readonly dbManager: DbManager;
  private readonly dbConfigStore: DbConfigStore;

  constructor(app: App) {
    super();

    this.dbConfigStore = new DbConfigStore(app);
    this.dbManager = new DbManager(app, this.dbConfigStore);
  }

  public async initialize(app: App): Promise<void> {
    if (
      app.mode !== AppMode.Development ||
      !isCanary() ||
      !isNewQueryRunExperienceEnabled()
    ) {
      // Currently, we only want to expose the new database panel when we
      // are in development and canary mode and the developer has enabled the
      // new query run experience.
      return;
    }

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

export async function initializeDbModule(app: App): Promise<DbModule> {
  const dbModule = new DbModule(app);
  await dbModule.initialize(app);
  return dbModule;
}
