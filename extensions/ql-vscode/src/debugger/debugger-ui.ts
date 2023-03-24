import {
  DebugAdapterTracker,
  DebugAdapterTrackerFactory,
  DebugSession,
  debug,
  //  window,
  Uri,
  CancellationTokenSource,
} from "vscode";
import { BaseLogger, queryServerLogger, TeeLogger } from "../common";
import { createTimestampFile } from "../helpers";
import { ResultsView } from "../interface";
import { WebviewReveal } from "../interface-utils";
import { DatabaseItem, DatabaseManager } from "../local-databases";
import { DisposableObject } from "../pure/disposable-object";
import { QueryHistoryManager } from "../query-history/query-history-manager";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "../query-results";
import { QueryRunner } from "../queryRunner";
import { createInitialQueryInfo, QueryOutputDir } from "../run-queries-shared";
import { QLResolvedDebugConfiguration } from "./debug-configuration";
import * as CodeQLDebugProtocol from "./debug-protocol";

interface ActiveEvaluation {
  queryInfo: LocalQueryInfo;
  dbItem: DatabaseItem;
  outputDir: QueryOutputDir;
  logger: BaseLogger;
  result: CodeQLDebugProtocol.EvaluationCompletedEventBody | undefined;
}

class QLDebugAdapterTracker
  extends DisposableObject
  implements DebugAdapterTracker
{
  private readonly configuration: QLResolvedDebugConfiguration;
  private evaluation: ActiveEvaluation | undefined;
  /** The promise of the most recently queued deferred message handler. */
  private lastDeferredMessageHandler: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: DebugSession,
    private readonly ui: DebuggerUI,
    private readonly dbm: DatabaseManager,
    private readonly qhm: QueryHistoryManager,
    private readonly queryRunner: QueryRunner,
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
            void this.evaluation?.logger.log(message.body.output);
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
    const outputDir = new QueryOutputDir(body.outputDir);

    await createTimestampFile(outputDir.querySaveDir);

    const dbUri = Uri.file(this.configuration.database);
    const dbItem = await this.dbm.createOrOpenDatabaseItem(dbUri);
    const initialInfo = await createInitialQueryInfo(
      Uri.file(this.configuration.query),
      {
        databaseUri: dbUri.toString(),
        name: dbItem.name,
      },
      false,
      undefined,
    );

    // When cancellation is requested from the query history view, we just stop the debug session.
    const tokenSource = new CancellationTokenSource();
    tokenSource.token.onCancellationRequested(() =>
      debug.stopDebugging(this.session),
    );
    const queryInfo = new LocalQueryInfo(initialInfo, tokenSource);
    this.qhm.addQuery(queryInfo);

    this.evaluation = {
      queryInfo,
      dbItem,
      outputDir,
      logger: new TeeLogger(queryServerLogger, outputDir.logPath),
      result: undefined,
    };
  }

  private async onEvaluationCompleted(
    body: CodeQLDebugProtocol.EvaluationCompletedEventBody,
  ): Promise<void> {
    if (this.evaluation !== undefined) {
      this.evaluation.result = body;
      if (this.evaluation.queryInfo !== undefined) {
        const evalLogPaths = await this.queryRunner.summarizeEvalLog(
          this.evaluation.result?.resultType,
          this.evaluation.outputDir,
          this.evaluation.logger,
        );
        if (evalLogPaths !== undefined) {
          this.evaluation.queryInfo.setEvaluatorLogPaths(evalLogPaths);
        }
        const queryWithResults = await this.queryRunner.getCompletedQueryInfo(
          this.evaluation.dbItem,
          {
            queryPath: this.configuration.query,
            quickEvalPosition: undefined,
          },
          this.evaluation.outputDir,
          this.evaluation.result,
        );
        this.qhm.completeQuery(this.evaluation.queryInfo, queryWithResults);
        await this.ui.showResultsForCompletedQuery(
          this.evaluation.queryInfo as CompletedLocalQueryInfo,
          WebviewReveal.Forced,
        );
        // Note we must update the query history view after showing results as the
        // display and sorting might depend on the number of results
        await this.qhm.refreshTreeView();
      }
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
    private readonly dbm: DatabaseManager,
    private readonly qhm: QueryHistoryManager,
    private readonly queryRunner: QueryRunner,
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
        this.dbm,
        this.qhm,
        this.queryRunner,
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
