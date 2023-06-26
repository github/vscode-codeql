import { CodeQLCliServer } from "../codeql-cli/cli";
import { extLogger } from "../common/logging/vscode";
import { App } from "../common/app";
import { isCanary, showQueriesPanel } from "../config";
import { DisposableObject } from "../common/disposable-object";
import { QueriesPanel } from "./queries-panel";
import { QueryDiscovery } from "./query-discovery";
import { QueryPackDiscovery } from "./query-pack-discovery";

export class QueriesModule extends DisposableObject {
  private queriesPanel: QueriesPanel | undefined;

  private constructor(readonly app: App) {
    super();
  }

  public static initialize(
    app: App,
    cliServer: CodeQLCliServer,
  ): QueriesModule {
    const queriesModule = new QueriesModule(app);
    app.subscriptions.push(queriesModule);

    queriesModule.initialize(app, cliServer);
    return queriesModule;
  }

  private initialize(app: App, cliServer: CodeQLCliServer): void {
    // Currently, we only want to expose the new panel when we are in canary mode
    // and the user has enabled the "Show queries panel" flag.
    if (!isCanary() || !showQueriesPanel()) {
      return;
    }
    void extLogger.log("Initializing queries panel.");

    const queryPackDiscovery = new QueryPackDiscovery(cliServer);
    this.push(queryPackDiscovery);
    void queryPackDiscovery.initialRefresh();

    const queryDiscovery = new QueryDiscovery(
      app.environment,
      queryPackDiscovery,
    );
    this.push(queryDiscovery);
    void queryDiscovery.initialRefresh();

    this.queriesPanel = new QueriesPanel(queryDiscovery);
    this.push(this.queriesPanel);
  }
}
