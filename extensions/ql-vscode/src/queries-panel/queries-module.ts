import { App, AppMode } from "../common/app";
import { isCanary, showQueriesPanel } from "../config";
import { DisposableObject } from "../pure/disposable-object";
import { QueriesPanel } from "./queries-panel";

export class QueriesModule extends DisposableObject {
  private queriesPanel: QueriesPanel | undefined;

  private constructor(readonly app: App) {
    super();
  }

  private async initialize(app: App): Promise<void> {
    if (app.mode === AppMode.Production || !isCanary() || !showQueriesPanel()) {
      // Currently, we only want to expose the new panel when we are in development and canary mode
      // and the developer has enabled the "Show queries panel" flag.
      return;
    }
    this.queriesPanel = new QueriesPanel();
    this.push(this.queriesPanel);
  }

  public static async initialize(app: App): Promise<QueriesModule> {
    const queriesModule = new QueriesModule(app);
    app.subscriptions.push(queriesModule);

    await queriesModule.initialize(app);
    return queriesModule;
  }
}
