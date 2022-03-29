import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

import { DisposableObject } from './pure/disposable-object';
import { Disposable, CancellationToken, commands } from 'vscode';
import { createMessageConnection, MessageConnection, RequestType } from 'vscode-jsonrpc';
import * as cli from './cli';
import { QueryServerConfig } from './config';
import { Logger, ProgressReporter } from './logging';
import { completeQuery, EvaluationResult, progress, ProgressMessage, WithProgressId } from './pure/messages';
import * as messages from './pure/messages';
import { ProgressCallback, ProgressTask } from './commandRunner';

type ServerOpts = {
  logger: Logger;
  contextStoragePath: string;
}

/** A running query server process and its associated message connection. */
class ServerProcess implements Disposable {
  child: cp.ChildProcess;
  connection: MessageConnection;
  logger: Logger;

  constructor(child: cp.ChildProcess, connection: MessageConnection, logger: Logger) {
    this.child = child;
    this.connection = connection;
    this.logger = logger;
  }

  dispose(): void {
    void this.logger.log('Stopping query server...');
    this.connection.dispose();
    this.child.stdin!.end();
    this.child.stderr!.destroy();
    // TODO kill the process if it doesn't terminate after a certain time limit.

    // On Windows, we usually have to terminate the process before closing its stdout.
    this.child.stdout!.destroy();
    void this.logger.log('Stopped query server.');
  }
}

type WithProgressReporting = (task: (progress: ProgressReporter, token: CancellationToken) => Thenable<void>) => Thenable<void>;

/**
 * Client that manages a query server process.
 * The server process is started upon initialization and tracked during its lifetime.
 * The server process is disposed when the client is disposed, or if the client asks
 * to restart it (which disposes the existing process and starts a new one).
 */
export class QueryServerClient extends DisposableObject {

  serverProcess?: ServerProcess;
  evaluationResultCallbacks: { [key: number]: (res: EvaluationResult) => void };
  progressCallbacks: { [key: number]: ((res: ProgressMessage) => void) | undefined };
  nextCallback: number;
  nextProgress: number;
  withProgressReporting: WithProgressReporting;

  private readonly queryServerStartListeners = [] as ProgressTask<void>[];

  // Can't use standard vscode EventEmitter here since they do not cause the calling
  // function to fail if one of the event handlers fail. This is something that
  // we need here.
  readonly onDidStartQueryServer = (e: ProgressTask<void>) => {
    this.queryServerStartListeners.push(e);
  }

  public activeQueryLogFile: string | undefined;

  constructor(
    readonly config: QueryServerConfig,
    readonly cliServer: cli.CodeQLCliServer,
    readonly opts: ServerOpts,
    withProgressReporting: WithProgressReporting
  ) {
    super();
    // When the query server configuration changes, restart the query server.
    if (config.onDidChangeConfiguration !== undefined) {
      this.push(config.onDidChangeConfiguration(() =>
        commands.executeCommand('codeQL.restartQueryServer')));
    }
    this.withProgressReporting = withProgressReporting;
    this.nextCallback = 0;
    this.nextProgress = 0;
    this.progressCallbacks = {};
    this.evaluationResultCallbacks = {};
  }

  get logger(): Logger {
    return this.opts.logger;
  }

  /** Stops the query server by disposing of the current server process. */
  private stopQueryServer(): void {
    if (this.serverProcess !== undefined) {
      this.disposeAndStopTracking(this.serverProcess);
    } else {
      void this.logger.log('No server process to be stopped.');
    }
  }

  /** Restarts the query server by disposing of the current server process and then starting a new one. */
  async restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken
  ): Promise<void> {
    this.stopQueryServer();
    await this.startQueryServer();

    // Ensure we await all responses from event handlers so that
    // errors can be properly reported to the user.
    await Promise.all(this.queryServerStartListeners.map(handler => handler(
      progress,
      token
    )));
  }

  showLog(): void {
    this.logger.show();
  }

  /** Starts a new query server process, sending progress messages to the status bar. */
  async startQueryServer(): Promise<void> {
    // Use an arrow function to preserve the value of `this`.
    return this.withProgressReporting((progress, _) => this.startQueryServerImpl(progress));
  }

  /** Starts a new query server process, sending progress messages to the given reporter. */
  private async startQueryServerImpl(progressReporter: ProgressReporter): Promise<void> {
    const ramArgs = await this.cliServer.resolveRam(this.config.queryMemoryMb, progressReporter);
    const args = ['--threads', this.config.numThreads.toString()].concat(ramArgs);

    if (this.config.saveCache) {
      args.push('--save-cache');
    }

    if (this.config.cacheSize > 0) {
      args.push('--max-disk-cache');
      args.push(this.config.cacheSize.toString());
    }

    if (await this.cliServer.cliConstraints.supportsDatabaseRegistration()) {
      args.push('--require-db-registration');
    }

    if (await this.cliServer.cliConstraints.supportsOldEvalStats() && !(await this.cliServer.cliConstraints.supportsPerQueryEvalLog())) {
      args.push('--old-eval-stats');
    }

    if (await this.cliServer.cliConstraints.supportsStructuredEvalLog()) {
      const structuredLogFile = `${this.opts.contextStoragePath}/structured-evaluator-log.json`;
      await fs.ensureFile(structuredLogFile);

      args.push('--evaluator-log');
      args.push(structuredLogFile);

      // We hard-code the verbosity level to 5 and minify to false.
      // This will be the behavior of the per-query structured logging in the CLI after 2.8.3.
      args.push('--evaluator-log-level');
      args.push('5');
    }

    if (this.config.debug) {
      args.push('--debug', '--tuple-counting');
    }

    if (cli.shouldDebugQueryServer()) {
      args.push('-J=-agentlib:jdwp=transport=dt_socket,address=localhost:9010,server=n,suspend=y,quiet=y');
    }

    const child = cli.spawnServer(
      this.config.codeQlPath,
      'CodeQL query server',
      ['execute', 'query-server'],
      args,
      this.logger,
      data => this.logger.log(data.toString(), {
        trailingNewline: false,
        additionalLogLocation: this.activeQueryLogFile
      }),
      undefined, // no listener for stdout
      progressReporter
    );
    progressReporter.report({ message: 'Connecting to CodeQL query server' });
    const connection = createMessageConnection(child.stdout, child.stdin);
    connection.onRequest(completeQuery, res => {
      if (!(res.runId in this.evaluationResultCallbacks)) {
        void this.logger.log(`No callback associated with run id ${res.runId}, continuing without executing any callback`);
      } else {
        this.evaluationResultCallbacks[res.runId](res);
      }
      return {};
    });
    connection.onNotification(progress, res => {
      const callback = this.progressCallbacks[res.id];
      if (callback) {
        callback(res);
      }
    });
    this.serverProcess = new ServerProcess(child, connection, this.logger);
    // Ensure the server process is disposed together with this client.
    this.track(this.serverProcess);
    connection.listen();
    progressReporter.report({ message: 'Connected to CodeQL query server' });
    this.nextCallback = 0;
    this.nextProgress = 0;
    this.progressCallbacks = {};
    this.evaluationResultCallbacks = {};
  }

  registerCallback(callback: (res: EvaluationResult) => void): number {
    const id = this.nextCallback++;
    this.evaluationResultCallbacks[id] = callback;
    return id;
  }

  unRegisterCallback(id: number): void {
    delete this.evaluationResultCallbacks[id];
  }

  get serverProcessPid(): number {
    return this.serverProcess!.child.pid || 0;
  }

  async sendRequest<P, R, E, RO>(type: RequestType<WithProgressId<P>, R, E, RO>, parameter: P, token?: CancellationToken, progress?: (res: ProgressMessage) => void): Promise<R> {
    const id = this.nextProgress++;
    this.progressCallbacks[id] = progress;

    this.updateActiveQuery(type.method, parameter);
    try {
      if (this.serverProcess === undefined) {
        throw new Error('No query server process found.');
      }
      return await this.serverProcess.connection.sendRequest(type, { body: parameter, progressId: id }, token);
    } finally {
      delete this.progressCallbacks[id];
    }
  }

  /**
   * Updates the active query every time there is a new request to compile.
   * The active query is used to specify the side log.
   *
   * This isn't ideal because in situations where there are queries running
   * in parallel, each query's log messages are interleaved. Fixing this
   * properly will require a change in the query server.
   */
  private updateActiveQuery(method: string, parameter: any): void {
    if (method === messages.compileQuery.method) {
      this.activeQueryLogFile = findQueryLogFile(path.dirname(parameter.resultPath));
    }
  }
}

export function findQueryLogFile(resultPath: string): string {
  return path.join(resultPath, 'query.log');
}

export function findQueryStructLogFile(resultPath: string): string {
  return path.join(resultPath, 'evaluator-log.jsonl');
}
