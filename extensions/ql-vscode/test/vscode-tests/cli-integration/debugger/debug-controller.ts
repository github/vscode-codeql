import type {
  DebugAdapterTracker,
  DebugAdapterTrackerFactory,
  DebugSession,
  ProviderResult,
  Uri,
} from "vscode";
import { debug, workspace } from "vscode";
import type * as CodeQLProtocol from "../../../../src/debugger/debug-protocol";
import { DisposableObject } from "../../../../src/common/disposable-object";
import { QueryResultType } from "../../../../src/query-server/messages";
import type { CoreCompletedQuery } from "../../../../src/query-server/query-runner";
import { QueryOutputDir } from "../../../../src/local-queries/query-output-dir";
import type {
  QLDebugArgs,
  QLDebugConfiguration,
} from "../../../../src/debugger/debug-configuration";
import { join } from "path";
import { writeFile } from "fs-extra";
import { expect } from "@jest/globals";
import type { AppCommandManager } from "../../../../src/common/commands";
import { getOnDiskWorkspaceFolders } from "../../../../src/common/vscode/workspace-folders";

type Resolver<T> = (value: T) => void;

/**
 * Listens for Debug Adapter Protocol messages from a particular debug session, and reports the
 * interesting events back to the `DebugController`.
 */
class Tracker implements DebugAdapterTracker {
  private database: string | undefined;
  private queryPath: string | undefined;
  private started: CodeQLProtocol.EvaluationStartedEvent["body"] | undefined =
    undefined;
  private completed:
    | CodeQLProtocol.EvaluationCompletedEvent["body"]
    | undefined = undefined;

  public constructor(
    private readonly session: DebugSession,
    private readonly controller: DebugController,
  ) {}

  public onWillReceiveMessage(
    message: CodeQLProtocol.AnyProtocolMessage,
  ): void {
    switch (message.type) {
      case "request":
        this.onWillReceiveRequest(message);
        break;
    }
  }

  public onDidSendMessage(message: CodeQLProtocol.AnyProtocolMessage): void {
    void this.session;
    switch (message.type) {
      case "event":
        this.onDidSendEvent(message);
        break;
    }
  }

  private onWillReceiveRequest(request: CodeQLProtocol.AnyRequest): void {
    switch (request.command) {
      case "launch":
        this.controller.handleEvent({
          kind: "launched",
          request,
        });
        break;
    }
  }

  private onDidSendEvent(event: CodeQLProtocol.AnyEvent): void {
    switch (event.event) {
      case "codeql-evaluation-started":
        this.started = event.body;
        break;

      case "codeql-evaluation-completed":
        this.completed = event.body;
        this.controller.handleEvent({
          kind: "evaluationCompleted",
          started: this.started!,
          results: {
            ...this.started!,
            ...this.completed!,
            outputDir: new QueryOutputDir(this.started!.outputDir),
            queryTarget: {
              queryPath: this.queryPath!,
              quickEvalPosition:
                this.started!.quickEvalContext?.quickEvalPosition,
            },
            dbPath: this.database!,
          },
        });
        break;

      case "exited":
        this.controller.handleEvent({
          kind: "exited",
          body: event.body,
        });
        break;

      case "stopped":
        this.controller.handleEvent({
          kind: "stopped",
        });
        break;
    }
  }
}

/**
 * An interesting event from the debug session. These are queued by the `DebugContoller`. The test
 * code consumes these events and asserts that they are in the correct order and have the correct
 * data.
 */
type DebugEventKind =
  | "launched"
  | "evaluationCompleted"
  | "terminated"
  | "stopped"
  | "exited"
  | "sessionClosed";

interface DebugEvent {
  kind: DebugEventKind;
}

interface LaunchedEvent extends DebugEvent {
  kind: "launched";
  request: CodeQLProtocol.LaunchRequest;
}

interface EvaluationCompletedEvent extends DebugEvent {
  kind: "evaluationCompleted";
  started: CodeQLProtocol.EvaluationStartedEvent["body"];
  results: CoreCompletedQuery;
}

interface TerminatedEvent extends DebugEvent {
  kind: "terminated";
}

interface StoppedEvent extends DebugEvent {
  kind: "stopped";
}

interface ExitedEvent extends DebugEvent {
  kind: "exited";
  body: CodeQLProtocol.ExitedEvent["body"];
}

interface SessionClosedEvent extends DebugEvent {
  kind: "sessionClosed";
}

type AnyDebugEvent =
  | LaunchedEvent
  | EvaluationCompletedEvent
  | StoppedEvent
  | ExitedEvent
  | TerminatedEvent
  | SessionClosedEvent;

/**
 * Exposes a simple facade over a debugging session. Test code invokes the various commands as
 * async functions, and consumes events reported by the session to ensure the correct sequence and
 * data.
 */
class DebugController
  extends DisposableObject
  implements DebugAdapterTrackerFactory
{
  /** Queue of events reported by the session. */
  private readonly eventQueue: AnyDebugEvent[] = [];
  /**
   * The index of the next event to be read from the queue. This index may be equal to the length of
   * the queue, in which case all events received so far have been consumed, and the next attempt to
   * consume an event will block waiting for that event.
   * */
  private nextEventIndex = 0;
  /**
   * If the client is currently blocked waiting for a new event, this property holds the `resolve()`
   * function that will resolve the promise on which the client is blocked.
   */
  private resolver: Resolver<AnyDebugEvent> | undefined = undefined;

  public constructor(private readonly appCommands: AppCommandManager) {
    super();
    this.push(debug.registerDebugAdapterTrackerFactory("codeql", this));
    this.push(
      debug.onDidTerminateDebugSession(
        this.handleDidTerminateDebugSession.bind(this),
      ),
    );
    this.push(
      debug.onDidChangeActiveDebugSession(
        this.handleDidChangeActiveDebugSession.bind(this),
      ),
    );
  }

  public createDebugAdapterTracker(
    session: DebugSession,
  ): ProviderResult<DebugAdapterTracker> {
    return new Tracker(session, this);
  }

  public async createLaunchJson(config: QLDebugConfiguration): Promise<void> {
    const launchJsonPath = join(
      getOnDiskWorkspaceFolders()[0],
      ".vscode/launch.json",
    );

    await writeFile(
      launchJsonPath,
      JSON.stringify({
        version: "0.2.0",
        configurations: [config],
      }),
    );
  }

  /**
   * Starts a debug session via the "codeQL.debugQuery" copmmand.
   */
  public debugQuery(uri: Uri): Promise<void> {
    return this.appCommands.execute("codeQL.debugQuery", uri);
  }

  public async startDebugging(
    config: QLDebugArgs,
    noDebug = false,
  ): Promise<void> {
    const fullConfig: QLDebugConfiguration = {
      ...config,
      name: "test",
      type: "codeql",
      request: "launch",
    };
    const options = noDebug
      ? {
          noDebug: true,
        }
      : {};

    return await this.appCommands.execute("workbench.action.debug.start", {
      config: fullConfig,
      ...options,
    });
  }

  public async startDebuggingSelection(config: QLDebugArgs): Promise<void> {
    return await this.startDebugging({
      ...config,
      quickEval: true,
    });
  }

  public async continueDebuggingSelection(): Promise<void> {
    return await this.appCommands.execute("codeQL.continueDebuggingSelection");
  }

  public async stepInto(): Promise<void> {
    return await this.appCommands.execute("workbench.action.debug.stepInto");
  }

  public async stepOver(): Promise<void> {
    return await this.appCommands.execute("workbench.action.debug.stepOver");
  }

  public async stepOut(): Promise<void> {
    return await this.appCommands.execute("workbench.action.debug.stepOut");
  }

  public handleEvent(event: AnyDebugEvent): void {
    this.eventQueue.push(event);
    if (this.resolver !== undefined) {
      // We were waiting for this one. Resolve it.
      this.nextEventIndex++;
      const resolver = this.resolver;
      this.resolver = undefined;
      resolver(event);
    }
  }

  private handleDidTerminateDebugSession(_session: DebugSession): void {
    this.handleEvent({
      kind: "terminated",
    });
  }

  private handleDidChangeActiveDebugSession(
    session: DebugSession | undefined,
  ): void {
    if (session === undefined) {
      this.handleEvent({
        kind: "sessionClosed",
      });
    }
  }

  /**
   * Consumes the next event in the queue. If all received messages have already been consumed, this
   * function blocks until another event is received.
   */
  private async nextEvent(): Promise<AnyDebugEvent> {
    if (this.resolver !== undefined) {
      throw new Error("Attempt to wait for multiple debugger events at once.");
    } else {
      if (this.nextEventIndex < this.eventQueue.length) {
        // No need to wait.
        const event = this.eventQueue[this.nextEventIndex];
        this.nextEventIndex++;
        return Promise.resolve(event);
      } else {
        // No event available yet, so we need to wait.
        return new Promise((resolve, _reject) => {
          this.resolver = resolve;
        });
      }
    }
  }

  /**
   * Consume the next event in the queue, and assert that it is of the specified type.
   */
  private async expectEvent<T extends DebugEvent>(kind: T["kind"]): Promise<T> {
    const event = await this.nextEvent();
    expect(event.kind).toBe(kind);
    return <T>event;
  }

  public async expectLaunched(): Promise<LaunchedEvent> {
    return this.expectEvent<LaunchedEvent>("launched");
  }

  public async expectExited(): Promise<ExitedEvent> {
    return this.expectEvent<ExitedEvent>("exited");
  }

  public async expectCompleted(): Promise<EvaluationCompletedEvent> {
    return await this.expectEvent<EvaluationCompletedEvent>(
      "evaluationCompleted",
    );
  }

  public async expectSucceeded(): Promise<EvaluationCompletedEvent> {
    const event = await this.expectCompleted();
    if (event.results.resultType !== QueryResultType.SUCCESS) {
      expect(event.results.message).toBe("success");
    }
    return event;
  }

  public async expectFailed(): Promise<EvaluationCompletedEvent> {
    const event = await this.expectCompleted();
    expect(event.results.resultType).not.toEqual(QueryResultType.SUCCESS);
    return event;
  }

  public async expectStopped(): Promise<StoppedEvent> {
    return await this.expectEvent<StoppedEvent>("stopped");
  }

  public async expectTerminated(): Promise<TerminatedEvent> {
    return this.expectEvent<TerminatedEvent>("terminated");
  }

  public async expectSessionClosed(): Promise<SessionClosedEvent> {
    return this.expectEvent<SessionClosedEvent>("sessionClosed");
  }

  /**
   * Wait the specified number of milliseconds, and fail the test if any events are received within
   * that timeframe.
   */
  public async expectNoEvents(duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.nextEventIndex < this.eventQueue.length) {
          const event = this.eventQueue[this.nextEventIndex];
          reject(
            new Error(
              `Did not expect to receive any events, but received '${event.kind}'.`,
            ),
          );
        } else {
          resolve();
        }
      }, duration);
    });
  }
}

/**
 * Execute a function with a new instance of `DebugContoller`. Once the function completes, the
 * debug controller is cleaned up.
 */
export async function withDebugController<T>(
  appCommands: AppCommandManager,
  op: (controller: DebugController) => Promise<T>,
): Promise<T> {
  await workspace.getConfiguration().update("codeQL.canary", true);
  try {
    const controller = new DebugController(appCommands);
    try {
      try {
        const result = await op(controller);
        // The test should have consumed all expected events. Wait a couple seconds to make sure
        // no more come in.
        await controller.expectNoEvents(2000);
        return result;
      } finally {
        await debug.stopDebugging();
      }
    } finally {
      // In a separate finally block so that the controller gets disposed even if `stopDebugging()`
      // fails.
      controller.dispose();
    }
  } finally {
    await workspace.getConfiguration().update("codeQL.canary", false);
  }
}
