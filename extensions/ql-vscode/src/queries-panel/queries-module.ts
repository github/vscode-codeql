import { CodeQLCliServer } from "../codeql-cli/cli";
import { extLogger } from "../common";
import { App, AppMode } from "../common/app";
import { isCanary, showQueriesPanel } from "../config";
import { DisposableObject } from "../pure/disposable-object";
import { QueriesPanel } from "./queries-panel";
import { QueryDiscovery } from "./query-discovery";
import * as vscode from "vscode";

export class QueriesModule extends DisposableObject {
  private queriesPanel: QueriesPanel | undefined;
  private queryDiscovery: QueryDiscovery | undefined;

  private constructor(readonly app: App) {
    super();
  }

  private initialize(app: App, cliServer: CodeQLCliServer): void {
    if (app.mode === AppMode.Production || !isCanary() || !showQueriesPanel()) {
      // Currently, we only want to expose the new panel when we are in development and canary mode
      // and the developer has enabled the "Show queries panel" flag.
      return;
    }
    void extLogger.log("Initializing queries panel.");

    this.queriesPanel = new QueriesPanel();
    this.push(this.queriesPanel);

    // Temporarily just scan the first workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw Error("No workspace folder found.");
    }

    this.queryDiscovery = new QueryDiscovery(workspaceFolder, cliServer);
    this.queryDiscovery.refresh();
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
