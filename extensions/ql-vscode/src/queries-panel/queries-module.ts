import { CodeQLCliServer } from "../codeql-cli/cli";
import { extLogger } from "../common";
import { App } from "../common/app";
import { isCanary, showQueriesPanel } from "../config";
import { DisposableObject } from "../pure/disposable-object";
import { QueriesPanel } from "./queries-panel";
import { QueryDiscovery } from "./query-discovery";
import { QueryPackDiscovery } from "./query-pack-discovery";

export class QueriesModule extends DisposableObject {
  private constructor(readonly app: App) {
    super();
  }

  private initialize(app: App, cliServer: CodeQLCliServer): void {
    if (!isCanary() || !showQueriesPanel()) {
      // Currently, we only want to expose the new panel when we are in canary mode
      // and the user has enabled the "Show queries panel" flag.
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

    const queriesPanel = new QueriesPanel(queryDiscovery);
    this.push(queriesPanel);
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
}
