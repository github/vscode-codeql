import { MessageConnection, RequestType, CancellationToken, createMessageConnection } from 'vscode-jsonrpc';
import { EvaluationResult, completeQuery, WithProgressId, ProgressMessage, progress } from './messages';
import * as path from 'path';
import * as cp from 'child_process';
import { Logger } from './logging';
import { DisposableObject } from 'semmle-vscode-utils';
import { Disposable } from 'vscode';
import { QLConfiguration } from './config';

type ServerOpts = {
  logger: Logger
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

  dispose() {
    this.logger.log('Stopping query server...');
    this.connection.dispose();
    this.child.stdin!.end();
    this.child.stderr!.destroy();
    // TODO kill the process if it doesn't terminate after a certain time limit.

    // On Windows, we usually have to terminate the process before closing its stdout.
    this.child.stdout!.destroy();
    this.logger.log('Stopped query server.');
  }
}

/**
 * Client that manages a query server process.
 * The server process is started upon initialisation and tracked during its lifetime.
 * The server process is disposed when the client is disposed, or if the client asks
 * to restart it (which disposes the existing process and starts a new one).
 */
export class QueryServerClient extends DisposableObject {
  log(s: string) {
    (this.opts.logger.log)(s);
  }

  readonly config: QLConfiguration;
  opts: ServerOpts;
  serverProcess?: ServerProcess;
  evaluationResultCallbacks: { [key: number]: (res: EvaluationResult) => void };
  progressCallbacks: { [key: number]: ((res: ProgressMessage) => void) | undefined };
  nextCallback: number;
  nextProgress: number;

  constructor(config: QLConfiguration, opts: ServerOpts) {
    super();
    this.config = config;
    // The logger is obtained from the caller, to ensure testability.
    // The extension passes in its dedicated query server logger.
    // The unit tests pass in a console logger that doesn't require the VSCode API.
    this.opts = opts;
    // When the query server configuration changes, restart the query server.
    if(config.onDidChangeQueryServerConfiguration !== undefined) {
      this.push(config.onDidChangeQueryServerConfiguration(this.restartQueryServer, this));
    }
    this.startQueryServer();
  }

  /** Stops the query server by disposing of the current server process. */
  private stopQueryServer() {
    if (this.serverProcess !== undefined) {
      this.disposeAndStopTracking(this.serverProcess);
    } else {
      this.log('No server process to be stopped.')
    }
  }

  /** Restarts the query server by disposing of the current server process and then starting a new one. */
  private restartQueryServer() {
    this.log('Restarting query server due to configuration changes...');
    this.stopQueryServer();
    this.startQueryServer();
  }

  /** Starts a new query server process. */
  private startQueryServer() {
    this.log("Starting QL query server using JSON-RPC...");
    const command = this.config.javaCommand;
    if (command === undefined) {
      throw new Error('Semmle distribution path not set.');
    }
    const jvmArgs = [
      '-cp', path.resolve(this.config.qlDistributionPath, 'tools/odasa.jar'),
      '-Xms512m',
      `-Xmx${this.config.queryMemoryMb.toString()}m`,
      'com.semmle.api.server.CombinedServer'
    ];
    const otherArgs = ['--threads', this.config.numThreads.toString()];
    const args = jvmArgs.concat(otherArgs);
    const argsString = args.join(" ");
    this.log(`Launching query server using ${command} ${argsString}...`);
    const child = cp.spawn(command, args);
    if (!child || !child.pid) {
      throw new Error(`Launching query server ${command} ${argsString} failed.`);
    }

    child.stderr.on('data', data => {
      this.log(`stderr: ${data}`);
    });
    child.on('close', (code) => {
      this.log(`Child process exited with code ${code}`);
    });
    const connection = createMessageConnection(child.stdout, child.stdin);
    connection.onRequest(completeQuery, res => {
      if (!(res.runId in this.evaluationResultCallbacks)) {
        this.log(`No callback associated with run id ${res.runId}, continuing without executing any callback`);
      }
      else {
        this.evaluationResultCallbacks[res.runId](res);
      }
      return {};
    })
    connection.onNotification(progress, res => {
      let callback = this.progressCallbacks[res.id];
      if (callback) {
        callback(res);
      }
    })
    this.serverProcess = new ServerProcess(child, connection, this.opts.logger);
    // Ensure the server process is disposed together with this client.
    this.track(this.serverProcess);
    connection.listen();
    this.nextCallback = 0;
    this.nextProgress = 0;
    this.progressCallbacks = {};
    this.evaluationResultCallbacks = {};
    this.log(`Query server started on PID: ${this.serverProcessPid}`);
  }

  registerCallback(callback: (res: EvaluationResult) => void): number {
    const id = this.nextCallback++;
    this.evaluationResultCallbacks[id] = callback;
    return id;
  }

  unRegisterCallback(id: number) {
    delete this.evaluationResultCallbacks[id];
  }

  get serverProcessPid(): number {
    return this.serverProcess!.child.pid;
  }

  async sendRequest<P, R, E, RO>(type: RequestType<WithProgressId<P>, R, E, RO>, parameter: P, token?: CancellationToken, progress?: (res: ProgressMessage) => void): Promise<R> {
    let id = this.nextProgress++;
    this.progressCallbacks[id] = progress;
    try {
      if (this.serverProcess === undefined) {
        throw new Error('No query server process found.');
      }
      return await this.serverProcess.connection.sendRequest(type, { body: parameter, progressId: id }, token);
    } finally {
      delete this.progressCallbacks[id];
    }
  }
}
