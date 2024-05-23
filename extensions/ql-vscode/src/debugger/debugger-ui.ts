import { basename } from "path";
import type {
  DebugAdapterTracker,
  DebugAdapterTrackerFactory,
  DebugSession,
} from "vscode";
import { debug, Uri, CancellationTokenSource } from "vscode";
import type { DebuggerCommands } from "../common/commands";
import type { DatabaseManager } from "../databases/local-databases";
import { DisposableObject } from "../common/disposable-object";
import type { CoreQueryResults } from "../query-server";
import {
  getQuickEvalContext,
  saveBeforeStart,
  validateQueryUri,
} from "../run-queries-shared";
import { QueryOutputDir } from "../local-queries/query-output-dir";
import type { QLResolvedDebugConfiguration } from "./debug-configuration";
import type {
  AnyProtocolMessage,
  EvaluationCompletedEvent,
  EvaluationStartedEvent,
  QuickEvalRequest,
} from "./debug-protocol";
import type { App } from "../common/app";
import type { LocalQueryRun, LocalQueries } from "../local-queries";

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

  public onDidSendMessage(message: AnyProtocolMessage): void {
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

  public async quickEval(): Promise<void> {
    // Since we're not going through VS Code's launch path, we need to save dirty files ourselves.
    await saveBeforeStart();

    const args: QuickEvalRequest["arguments"] = {
      quickEvalContext: await getQuickEvalContext(undefined, false),
    };
    await this.session.customRequest("codeql-quickeval", args);
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
    body: EvaluationStartedEvent["body"],
  ): Promise<void> {
    const dbUri = Uri.file(this.configuration.database);
    const dbItem = await this.dbm.createOrOpenDatabaseItem(dbUri, {
      type: "debugger",
    });

    // When cancellation is requested from the query history view, we just stop the debug session.
    const tokenSource = new CancellationTokenSource();
    tokenSource.token.onCancellationRequested(() =>
      debug.stopDebugging(this.session),
    );

    this.localQueryRun = await this.localQueries.createLocalQueryRun(
      {
        queryPath: this.configuration.query,
        quickEval: body.quickEvalContext,
      },
      dbItem,
      new QueryOutputDir(body.outputDir),
      tokenSource,
    );
  }

  /** Update the UI after a query has finished evaluating. */
  private async onEvaluationCompleted(
    body: EvaluationCompletedEvent["body"],
  ): Promise<void> {
    if (this.localQueryRun !== undefined) {
      const results: CoreQueryResults = body;
      await this.localQueryRun.complete(results, (_) => {});
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
    private readonly app: App,
    private readonly localQueries: LocalQueries,
    private readonly dbm: DatabaseManager,
  ) {
    super();

    this.push(debug.registerDebugAdapterTrackerFactory("codeql", this));
  }

  public getCommands(): DebuggerCommands {
    return {
      "codeQL.debugQuery": this.debugQuery.bind(this),
      "codeQL.debugQueryContextEditor": this.debugQuery.bind(this),
      "codeQL.startDebuggingSelectionContextEditor":
        this.startDebuggingSelection.bind(this),
      "codeQL.startDebuggingSelection": this.startDebuggingSelection.bind(this),
      "codeQL.continueDebuggingSelection":
        this.continueDebuggingSelection.bind(this),
      "codeQL.continueDebuggingSelectionContextEditor":
        this.continueDebuggingSelection.bind(this),
    };
  }

  public createDebugAdapterTracker(
    session: DebugSession,
  ): DebugAdapterTracker | undefined {
    if (session.type === "codeql") {
      // The tracker will be disposed in its own `onWillStopSession` handler.
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

  private async debugQuery(uri: Uri | undefined): Promise<void> {
    const queryPath =
      uri !== undefined
        ? validateQueryUri(uri, false)
        : await this.localQueries.getCurrentQuery(false);

    // Start debugging with a default configuration that just specifies the query path.
    await debug.startDebugging(undefined, {
      name: basename(queryPath),
      type: "codeql",
      request: "launch",
      query: queryPath,
    });
  }

  private async startDebuggingSelection(): Promise<void> {
    // Launch the currently selected debug configuration, but specifying QuickEval mode.
    await this.app.commands.execute("workbench.action.debug.start", {
      config: {
        quickEval: true,
      },
    });
  }

  private async continueDebuggingSelection(): Promise<void> {
    const activeTracker = this.activeTracker;
    if (activeTracker === undefined) {
      throw new Error("No CodeQL debug session is active.");
    }

    await activeTracker.quickEval();
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
}
