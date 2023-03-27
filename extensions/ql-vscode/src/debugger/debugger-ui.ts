import {
  DebugAdapterTracker,
  DebugAdapterTrackerFactory,
  DebugSession,
  debug,
  //  window,
  Uri,
  CancellationTokenSource,
} from "vscode";
import { ResultsView } from "../interface";
import { WebviewReveal } from "../interface-utils";
import { DatabaseManager } from "../local-databases";
import { LocalQueries, LocalQueryRun } from "../local-queries";
import { DisposableObject } from "../pure/disposable-object";
import { CompletedLocalQueryInfo } from "../query-results";
import { CoreQueryResults } from "../queryRunner";
import { QLResolvedDebugConfiguration } from "./debug-configuration";
import * as CodeQLDebugProtocol from "./debug-protocol";

class QLDebugAdapterTracker
  extends DisposableObject
  implements DebugAdapterTracker
{
  private readonly configuration: QLResolvedDebugConfiguration;
  private localQueryRun: LocalQueryRun | undefined;
  /** The promise of the most recently queued deferred message handler. */
  private lastDeferredMessageHandler: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: DebugSession,
    private readonly ui: DebuggerUI,
    private readonly localQueries: LocalQueries,
    private readonly dbm: DatabaseManager,
  ) {
    super();
    this.configuration = <QLResolvedDebugConfiguration>session.configuration;
  }

  public onDidSendMessage(
    message: CodeQLDebugProtocol.AnyProtocolMessage,
  ): void {
    if (message.type === "event") {
      switch (message.event) {
        case "codeql-evaluation-started":
          this.queueMessageHandler(() =>
            this.onEvaluationStarted(message.body),
          );
          break;
        case "codeql-evaluation-completed":
          this.queueMessageHandler(() =>
            this.onEvaluationCompleted(message.body),
          );
          break;
        case "output":
          if (message.body.category === "console") {
            void this.localQueryRun?.logger.log(message.body.output);
          }
          break;
      }
    }
  }

  public onWillStopSession(): void {
    this.ui.onSessionClosed(this.session);
    this.dispose();
  }

  private queueMessageHandler(handler: () => Promise<void>): void {
    this.lastDeferredMessageHandler =
      this.lastDeferredMessageHandler.finally(handler);
  }

  private async onEvaluationStarted(
    body: CodeQLDebugProtocol.EvaluationStartedEventBody,
  ): Promise<void> {
    const dbUri = Uri.file(this.configuration.database);
    const dbItem = await this.dbm.createOrOpenDatabaseItem(dbUri);

    // When cancellation is requested from the query history view, we just stop the debug session.
    const tokenSource = new CancellationTokenSource();
    tokenSource.token.onCancellationRequested(() =>
      debug.stopDebugging(this.session),
    );

    this.localQueryRun = await this.localQueries.createLocalQueryRun(
      this.configuration.query,
      false,
      undefined,
      dbItem,
      body.outputDir,
      tokenSource,
    );
  }

  private async onEvaluationCompleted(
    body: CodeQLDebugProtocol.EvaluationCompletedEventBody,
  ): Promise<void> {
    if (this.localQueryRun !== undefined) {
      const results: CoreQueryResults = body;
      await this.localQueryRun.complete(results);
      this.localQueryRun = undefined;
    }
  }
}

export class DebuggerUI
  extends DisposableObject
  implements DebugAdapterTrackerFactory
{
  private readonly sessions = new Map<string, QLDebugAdapterTracker>();

  constructor(
    private readonly localQueryResultsView: ResultsView,
    private readonly localQueries: LocalQueries,
    private readonly dbm: DatabaseManager,
  ) {
    super();

    this.push(debug.registerDebugAdapterTrackerFactory("codeql", this));
  }

  public createDebugAdapterTracker(
    session: DebugSession,
  ): DebugAdapterTracker | undefined {
    if (session.type === "codeql") {
      const tracker = new QLDebugAdapterTracker(
        session,
        this,
        this.localQueries,
        this.dbm,
      );
      this.sessions.set(session.id, tracker);
      return tracker;
    } else {
      return undefined;
    }
  }

  public onSessionClosed(session: DebugSession): void {
    this.sessions.delete(session.id);
  }

  private getTrackerForSession(
    session: DebugSession,
  ): QLDebugAdapterTracker | undefined {
    return this.sessions.get(session.id);
  }

  public get activeTracker(): QLDebugAdapterTracker | undefined {
    const session = debug.activeDebugSession;
    if (session === undefined) {
      return undefined;
    }

    return this.getTrackerForSession(session);
  }

  public async showResultsForCompletedQuery(
    query: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    await this.localQueryResultsView.showResults(query, forceReveal, false);
  }
}
