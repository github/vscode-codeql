import {
  DebugAdapterTracker,
  DebugAdapterTrackerFactory,
  DebugSession,
  debug,
  //  window,
  Uri,
  CancellationTokenSource,
  commands,
} from "vscode";
import { DebuggerCommands } from "../common/commands";
import { isCanary } from "../config";
import { ResultsView } from "../interface";
import { WebviewReveal } from "../interface-utils";
import { DatabaseManager } from "../local-databases";
import { LocalQueries, LocalQueryRun } from "../local-queries";
import { DisposableObject } from "../pure/disposable-object";
import { CompletedLocalQueryInfo } from "../query-results";
import { CoreQueryResults } from "../queryRunner";
import { QueryOutputDir } from "../run-queries-shared";
import { QLResolvedDebugConfiguration } from "./debug-configuration";
import * as CodeQLDebugProtocol from "./debug-protocol";

/**
 * Listens to messages passing between VS Code and the debug adapter, so that we can supplement the
 * UI.
 */
class QLDebugAdapterTracker
  extends DisposableObject
  implements DebugAdapterTracker
{
  private readonly configuration: QLResolvedDebugConfiguration;
  /** The `LocalQueryRun` of the current evaluation, if one is running. */
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

  /**
   * Queues a message handler to be executed once all other pending message handlers have completed.
   *
   * The `onDidSendMessage()` function is synchronous, so it needs to return before any async
   * handling of the msssage is completed. We can't just launch the message handler directly from
   * `onDidSendMessage()`, though, because if the message handler's implementation blocks awaiting
   * a promise, then another event might be received by `onDidSendMessage()` while the first message
   * handler is still incomplete.
   *
   * To enforce sequential execution of event handlers, we queue each new handler as a `finally()`
   * handler for the most recently queued message.
   */
  private queueMessageHandler(handler: () => Promise<void>): void {
    this.lastDeferredMessageHandler =
      this.lastDeferredMessageHandler.finally(handler);
  }

  /** Updates the UI to track the currently executing query. */
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

    const quickEval =
      this.configuration.quickEvalPosition !== undefined
        ? {
            quickEvalPosition: this.configuration.quickEvalPosition,
            quickEvalText: "quickeval!!!", // TODO: Have the debug adapter return the range, and extract the text from the editor.
          }
        : undefined;
    this.localQueryRun = await this.localQueries.createLocalQueryRun(
      {
        queryPath: this.configuration.query,
        quickEval,
      },
      dbItem,
      new QueryOutputDir(body.outputDir),
      tokenSource,
    );
  }

  /** Update the UI after a query has finished evaluating. */
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

/** Service handling the UI for CodeQL debugging. */
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

    if (isCanary()) {
      this.push(debug.registerDebugAdapterTrackerFactory("codeql", this));
    }
  }

  public getCommands(): DebuggerCommands {
    return {
      "codeQL.debug.quickEval": this.quickEval.bind(this),
      "codeQL.debug.quickEvalContextEditor": this.quickEval.bind(this),
    };
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

  private async quickEval(_uri: Uri): Promise<void> {
    await commands.executeCommand("workbench.action.debug.start", {
      config: {
        quickEval: true,
      },
    });
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
