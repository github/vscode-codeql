import { CodeQLCliServer } from "../codeql-cli/cli";
import { extLogger } from "../common/logging/vscode";
import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { QueriesPanel } from "./queries-panel";
import { QueryDiscovery } from "./query-discovery";
import { QueryPackDiscovery } from "./query-pack-discovery";
import { LanguageContextStore } from "../language-context-store";
import { TreeViewSelectionChangeEvent } from "vscode";
import { QueryTreeViewItem } from "./query-tree-view-item";

export class QueriesModule extends DisposableObject {
  private queriesPanel: QueriesPanel | undefined;
  private readonly onDidChangeSelectionEmitter = this.push(
    this.app.createEventEmitter<
      TreeViewSelectionChangeEvent<QueryTreeViewItem>
    >(),
  );

  public readonly onDidChangeSelection = this.onDidChangeSelectionEmitter.event;

  private constructor(readonly app: App) {
    super();
  }

  public static initialize(
    app: App,
    languageContext: LanguageContextStore,
    cliServer: CodeQLCliServer,
  ): QueriesModule {
    const queriesModule = new QueriesModule(app);
    app.subscriptions.push(queriesModule);

    queriesModule.initialize(app, languageContext, cliServer);
    return queriesModule;
  }

  private initialize(
    app: App,
    langauageContext: LanguageContextStore,
    cliServer: CodeQLCliServer,
  ): void {
    void extLogger.log("Initializing queries panel.");

    const queryPackDiscovery = new QueryPackDiscovery(cliServer);
    this.push(queryPackDiscovery);
    void queryPackDiscovery.initialRefresh();

    const queryDiscovery = new QueryDiscovery(
      app,
      queryPackDiscovery,
      langauageContext,
    );
    this.push(queryDiscovery);
    void queryDiscovery.initialRefresh();

    this.queriesPanel = new QueriesPanel(queryDiscovery, app);
    this.queriesPanel.onDidChangeSelection((event) =>
      this.onDidChangeSelectionEmitter.fire(event),
    );
    this.push(this.queriesPanel);
  }
}
