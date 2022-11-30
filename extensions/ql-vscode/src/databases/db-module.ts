import { App, AppMode } from "../common/app";
import { isCanary, isNewQueryRunExperienceEnabled } from "../config";
import { extLogger } from "../common";
import { DisposableObject } from "../pure/disposable-object";
import { DbConfigStore } from "./config/db-config-store";
import { DbManager } from "./db-manager";
import { DbPanel } from "./ui/db-panel";

export class DbModule extends DisposableObject {
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

    const dbConfigStore = new DbConfigStore(app);
    await dbConfigStore.initialize();

    const dbManager = new DbManager(app, dbConfigStore);
    const dbPanel = new DbPanel(dbManager);
    await dbPanel.initialize();

    this.push(dbPanel);
    this.push(dbConfigStore);
  }
}

export async function initializeDbModule(app: App): Promise<DbModule> {
  const dbModule = new DbModule();
  await dbModule.initialize(app);
  return dbModule;
}
