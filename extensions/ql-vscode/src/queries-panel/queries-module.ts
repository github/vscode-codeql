import { extLogger } from "../common";
import { App, AppMode } from "../common/app";
import { isCanary, showQueriesPanel } from "../config";
import { DisposableObject } from "../pure/disposable-object";
import { QueriesPanel } from "./queries-panel";

export class QueriesModule extends DisposableObject {
  private queriesPanel: QueriesPanel | undefined;

  private constructor(readonly app: App) {
    super();
  }

  private initialize(app: App): void {
    if (app.mode === AppMode.Production || !isCanary() || !showQueriesPanel()) {
      // Currently, we only want to expose the new panel when we are in development and canary mode
      // and the developer has enabled the "Show queries panel" flag.
      return;
    }
    void extLogger.log("Initializing queries panel.");

    this.queriesPanel = new QueriesPanel();
    this.push(this.queriesPanel);
  }

  public static initialize(app: App): QueriesModule {
    const queriesModule = new QueriesModule(app);
    app.subscriptions.push(queriesModule);

    queriesModule.initialize(app);
    return queriesModule;
  }
}
