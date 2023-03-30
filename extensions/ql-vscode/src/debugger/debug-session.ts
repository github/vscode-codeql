import {
  Event,
  ExitedEvent,
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  ProgressEndEvent,
  TerminatedEvent,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Disposable } from "vscode";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { BaseLogger, LogOptions } from "../common";
import { QueryResultType } from "../pure/new-messages";
import { CoreQueryResults, CoreQueryRun, QueryRunner } from "../queryRunner";
import * as CodeQLDebugProtocol from "./debug-protocol";

class ProgressStartEvent
  extends Event
  implements DebugProtocol.ProgressStartEvent
{
  public readonly event = "progressStart";
  public readonly body: {
    progressId: string;
    title: string;
    requestId?: number;
    cancellable?: boolean;
    message?: string;
    percentage?: number;
  };

  constructor(
    progressId: string,
    title: string,
    message?: string,
    percentage?: number,
  ) {
    super("progressStart");
    this.body = {
      progressId,
      title,
      message,
      percentage,
    };
  }
}

class ProgressUpdateEvent
  extends Event
  implements DebugProtocol.ProgressUpdateEvent
{
  public readonly event = "progressUpdate";
  public readonly body: {
    progressId: string;
    message?: string;
    percentage?: number;
  };

  constructor(progressId: string, message?: string, percentage?: number) {
    super("progressUpdate");
    this.body = {
      progressId,
      message,
      percentage,
    };
  }
}

class EvaluationStartedEvent
  extends Event
  implements CodeQLDebugProtocol.EvaluationStartedEvent
{
  public readonly event = "codeql-evaluation-started";
  public readonly body: CodeQLDebugProtocol.EvaluationStartedEventBody;

  constructor(id: string, outputDir: string) {
    super("codeql-evaluation-started");
    this.body = {
      id,
      outputDir,
    };
  }
}

class EvaluationCompletedEvent
  extends Event
  implements CodeQLDebugProtocol.EvaluationCompletedEvent
{
  public readonly event = "codeql-evaluation-completed";
  public readonly body: CodeQLDebugProtocol.EvaluationCompletedEventBody;

  constructor(results: CoreQueryResults) {
    super("codeql-evaluation-completed");
    this.body = results;
  }
}

export class QLDebugSession extends LoggingDebugSession implements Disposable {
  private args: CodeQLDebugProtocol.LaunchRequestArguments | undefined =
    undefined;
  private tokenSource: CancellationTokenSource | undefined = undefined;
  private queryRun: CoreQueryRun | undefined = undefined;

  constructor(
    private readonly queryStorageDir: string,
    private readonly queryRunner: QueryRunner,
  ) {
    super();
  }

  public dispose(): void {
    this.cancelEvaluation();
  }

  protected dispatchRequest(request: DebugProtocol.Request): void {
    super.dispatchRequest(request);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = response.body ?? {};
    response.body.supportsStepBack = false;
    response.body.supportsStepInTargetsRequest = false;
    response.body.supportsRestartFrame = false;
    response.body.supportsGotoTargetsRequest = false;

    this.sendResponse(response);

    this.sendEvent(new InitializedEvent());
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
    request?: DebugProtocol.Request,
  ): void {
    super.configurationDoneRequest(response, args, request);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
    _request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    // Neither of the args (`terminateDebuggee` and `restart`) matter for CodeQL.

    this.sendResponse(response);
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: CodeQLDebugProtocol.LaunchRequestArguments,
    _request?: DebugProtocol.Request,
  ): void {
    void this.launch(response, args); //TODO: Cancelation?
  }

  protected cancelRequest(
    response: DebugProtocol.CancelResponse,
    args: DebugProtocol.CancelArguments,
    _request?: DebugProtocol.Request,
  ): void {
    if (args.progressId !== undefined) {
      if (this.queryRun?.id === args.progressId) {
        this.cancelEvaluation();
      }
    }

    this.sendResponse(response);
  }

  protected threadsRequest(
    response: DebugProtocol.ThreadsResponse,
    request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    response.body.threads = [
      {
        id: 1,
        name: "Evaluation thread",
      },
    ];

    super.threadsRequest(response, request);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments,
    _request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    response.body.stackFrames = [];

    super.stackTraceRequest(response, _args, _request);
  }

  private async launch(
    response: DebugProtocol.LaunchResponse,
    args: CodeQLDebugProtocol.LaunchRequestArguments,
  ): Promise<void> {
    response.body = response.body ?? {};

    this.args = args;

    void this.evaluate(response);
  }

  private createLogger(): BaseLogger {
    return {
      log: async (message: string, _options: LogOptions): Promise<void> => {
        this.sendEvent(new OutputEvent(message, "console"));
      },
    };
  }

  private async evaluate(
    response: DebugProtocol.LaunchResponse,
  ): Promise<void> {
    // Send the response immediately. We'll send a "stopped" message when the evaluation is complete.
    this.sendResponse(response);

    const args = this.args!;

    this.tokenSource = new CancellationTokenSource();
    try {
      this.queryRun = this.queryRunner.createQueryRun(
        args.database,
        {
          queryPath: args.query,
          quickEvalPosition: undefined,
        },
        true,
        args.additionalPacks,
        args.extensionPacks,
        this.queryStorageDir,
        undefined,
        undefined,
      );

      // Send the `EvaluationStarted` event first, to let the client known where the outputs are
      // going to show up.
      this.sendEvent(
        new EvaluationStartedEvent(
          this.queryRun.id,
          this.queryRun.outputDir.querySaveDir,
        ),
      );
      const progressStart = new ProgressStartEvent(
        this.queryRun.id,
        "Running query",
        undefined,
        0,
      );
      progressStart.body.cancellable = true;
      this.sendEvent(progressStart);

      try {
        const result = await this.queryRun.evaluate(
          (p) => {
            const progressUpdate = new ProgressUpdateEvent(
              this.queryRun!.id,
              p.message,
              (p.step * 100) / p.maxStep,
            );
            this.sendEvent(progressUpdate);
          },
          this.tokenSource!.token,
          this.createLogger(),
        );

        this.completeEvaluation(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        this.completeEvaluation({
          resultType: QueryResultType.OTHER_ERROR,
          message,
          evaluationTime: 0,
        });
      }
    } finally {
      this.disposeTokenSource();
    }
  }

  private completeEvaluation(
    result: CodeQLDebugProtocol.EvaluationCompletedEventBody,
  ): void {
    // Report the end of the progress
    this.sendEvent(new ProgressEndEvent(this.queryRun!.id));
    // Report the evaluation result
    this.sendEvent(new EvaluationCompletedEvent(result));
    if (result.resultType !== QueryResultType.SUCCESS) {
      // Report the result message as "important" output
      const message = result.message ?? "Unknown error";
      const outputEvent = new OutputEvent(message, "console");
      this.sendEvent(outputEvent);
    }

    // Report the debugging session as terminated.
    this.sendEvent(new TerminatedEvent());

    // Report the debuggee as exited.
    this.sendEvent(new ExitedEvent(result.resultType));

    this.queryRun = undefined;
  }

  private disposeTokenSource(): void {
    if (this.tokenSource !== undefined) {
      this.tokenSource!.dispose();
      this.tokenSource = undefined;
    }
  }

  private cancelEvaluation(): void {
    if (this.tokenSource !== undefined) {
      this.tokenSource.cancel();
      this.disposeTokenSource();
    }
  }
}
