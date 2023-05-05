import { ensureFile } from "fs-extra";

import { DisposableObject, DisposeHandler } from "../pure/disposable-object";
import { CancellationToken } from "vscode";
import { createMessageConnection, RequestType } from "vscode-jsonrpc/node";
import * as cli from "../codeql-cli/cli";
import { QueryServerConfig } from "../config";
import { Logger, ProgressReporter } from "../common";
import {
  progress,
  ProgressMessage,
  WithProgressId,
} from "../pure/new-messages";
import {
  ProgressCallback,
  ProgressTask,
  withProgress,
} from "../common/vscode/progress";
import { ServerProcess } from "./server-process";
import { App } from "../common/app";
import { showAndLogErrorMessage } from "../helpers";

type ServerOpts = {
  logger: Logger;
  contextStoragePath: string;
};

type WithProgressReporting = (
  task: (
    progress: ProgressReporter,
    token: CancellationToken,
  ) => Thenable<void>,
) => Thenable<void>;

const MAX_UNEXPECTED_TERMINATIONS = 5;

/**
 * Client that manages a query server process.
 * The server process is started upon initialization and tracked during its lifetime.
 * The server process is disposed when the client is disposed, or if the client asks
 * to restart it (which disposes the existing process and starts a new one).
 */
export class QueryServerClient extends DisposableObject {
  serverProcess?: ServerProcess;
  progressCallbacks: {
    [key: number]: ((res: ProgressMessage) => void) | undefined;
  };
  nextCallback: number;
  nextProgress: number;

  unexpectedTerminationCount = 0;

  withProgressReporting: WithProgressReporting;

  private readonly queryServerStartListeners = [] as Array<ProgressTask<void>>;

  // Can't use standard vscode EventEmitter here since they do not cause the calling
  // function to fail if one of the event handlers fail. This is something that
  // we need here.
  readonly onDidStartQueryServer = (e: ProgressTask<void>) => {
    this.queryServerStartListeners.push(e);
  };

  public activeQueryLogger: Logger;

  constructor(
    app: App,
    readonly config: QueryServerConfig,
    readonly cliServer: cli.CodeQLCliServer,
    readonly opts: ServerOpts,
    withProgressReporting: WithProgressReporting,
  ) {
    super();
    // Since no query is active when we initialize, just point the "active query logger" to the
    // default logger.
    this.activeQueryLogger = this.logger;
    // When the query server configuration changes, restart the query server.
    if (config.onDidChangeConfiguration !== undefined) {
      this.push(
        config.onDidChangeConfiguration(() =>
          app.commands.execute("codeQL.restartQueryServerOnConfigChange"),
        ),
      );
    }
    this.withProgressReporting = withProgressReporting;
    this.nextCallback = 0;
    this.nextProgress = 0;
    this.progressCallbacks = {};
  }

  get logger(): Logger {
    return this.opts.logger;
  }

  /** Stops the query server by disposing of the current server process. */
  private stopQueryServer(): void {
    if (this.serverProcess !== undefined) {
      this.disposeAndStopTracking(this.serverProcess);
    } else {
      void this.logger.log("No server process to be stopped.");
    }
  }

  /**
   * Restarts the query server by disposing of the current server process and then starting a new one.
   * This resets the unexpected termination count. As hopefulyl it is an indication that the user has fixed the
   * issue.
   */
  async restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    // Reset the unexpected termination count when we restart the query server manually
    // or due to config change
    this.unexpectedTerminationCount = 0;
    await this.restartQueryServerInternal(progress, token);
  }

  /**
   * Try and restart the query server if it has unexpectedly terminated.
   */
  private restartQueryServerOnFailure() {
    if (this.unexpectedTerminationCount < MAX_UNEXPECTED_TERMINATIONS) {
      void withProgress(
        async (progress, token) =>
          this.restartQueryServerInternal(progress, token),
        {
          title: "Restarting CodeQL query server due to unexpected termination",
        },
      );
    } else {
      void showAndLogErrorMessage(
        "The CodeQL query server has unexpectedly terminated too many times. Please check the logs for errors. You can manually restart the query server using the command 'CodeQL: Restart query server'.",
      );
      // Make sure we dispose anyway to reject all pending requests.
      this.serverProcess?.dispose();
    }
    this.unexpectedTerminationCount++;
  }

  /**
   * Restarts the query server by disposing of the current server process and then starting a new one.
   * This does not reset the unexpected termination count.
   */
  private async restartQueryServerInternal(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    this.stopQueryServer();
    await this.startQueryServer();

    // Ensure we await all responses from event handlers so that
    // errors can be properly reported to the user.
    await Promise.all(
      this.queryServerStartListeners.map((handler) => handler(progress, token)),
    );
  }

  showLog(): void {
    this.logger.show();
  }

  /** Starts a new query server process, sending progress messages to the status bar. */
  async startQueryServer(): Promise<void> {
    // Use an arrow function to preserve the value of `this`.
    return this.withProgressReporting((progress, _) =>
      this.startQueryServerImpl(progress),
    );
  }

  /** Starts a new query server process, sending progress messages to the given reporter. */
  private async startQueryServerImpl(
    progressReporter: ProgressReporter,
  ): Promise<void> {
    void this.logger.log("Starting NEW query server.");

    const ramArgs = await this.cliServer.resolveRam(
      this.config.queryMemoryMb,
      progressReporter,
    );
    const args = ["--threads", this.config.numThreads.toString()].concat(
      ramArgs,
    );

    if (this.config.saveCache) {
      args.push("--save-cache");
    }

    if (this.config.cacheSize > 0) {
      args.push("--max-disk-cache");
      args.push(this.config.cacheSize.toString());
    }

    const structuredLogFile = `${this.opts.contextStoragePath}/structured-evaluator-log.json`;
    await ensureFile(structuredLogFile);

    args.push("--evaluator-log");
    args.push(structuredLogFile);

    // We hard-code the verbosity level to 5 and minify to false.
    // This will be the behavior of the per-query structured logging in the CLI after 2.8.3.
    args.push("--evaluator-log-level");
    args.push("5");

    if (this.config.debug) {
      args.push("--debug", "--tuple-counting");
    }

    if (cli.shouldDebugQueryServer()) {
      args.push(
        "-J=-agentlib:jdwp=transport=dt_socket,address=localhost:9010,server=y,suspend=y,quiet=y",
      );
    }

    const child = cli.spawnServer(
      this.config.codeQlPath,
      "CodeQL query server",
      ["execute", "query-server2"],
      args,
      this.logger,
      (data) =>
        this.activeQueryLogger.log(data.toString(), {
          trailingNewline: false,
        }),
      undefined, // no listener for stdout
      progressReporter,
    );
    progressReporter.report({ message: "Connecting to CodeQL query server" });
    const connection = createMessageConnection(child.stdout, child.stdin);
    connection.onNotification(progress, (res) => {
      const callback = this.progressCallbacks[res.id];
      if (callback) {
        callback(res);
      }
    });
    this.serverProcess = new ServerProcess(
      child,
      connection,
      "Query Server 2",
      this.logger,
    );
    // Ensure the server process is disposed together with this client.
    this.track(this.serverProcess);
    connection.listen();
    progressReporter.report({ message: "Connected to CodeQL query server v2" });
    this.nextCallback = 0;
    this.nextProgress = 0;
    this.progressCallbacks = {};
    child.on("close", () => {
      this.restartQueryServerOnFailure();
    });
  }

  get serverProcessPid(): number {
    return this.serverProcess!.child.pid || 0;
  }

  async sendRequest<P, R, E>(
    type: RequestType<WithProgressId<P>, R, E>,
    parameter: P,
    token?: CancellationToken,
    progress?: (res: ProgressMessage) => void,
  ): Promise<R> {
    const id = this.nextProgress++;
    this.progressCallbacks[id] = progress;

    try {
      if (this.serverProcess === undefined) {
        throw new Error("No query server process found.");
      }
      return await this.serverProcess.connection.sendRequest(
        type,
        { body: parameter, progressId: id },
        token,
      );
    } finally {
      delete this.progressCallbacks[id];
    }
  }

  public dispose(disposeHandler?: DisposeHandler | undefined): void {
    this.progressCallbacks = {};
    this.stopQueryServer();
    super.dispose(disposeHandler);
  }
}
