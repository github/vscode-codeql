import { MessageConnection, RequestType, CancellationToken, createMessageConnection } from 'vscode-jsonrpc';
import { EvaluationResult, completeQuery, WithProgressId, ProgressMessage, progress } from './messages';
import * as path from 'path';
import * as cp from 'child_process';
import { QLConfigurationData } from './configData';

type ServerOpts = {
  logger: (s: string) => void
}

export class Server {
  log(s: string) {
    if (this.opts && this.opts.logger) {
      (this.opts.logger)(s);
    }
  }

  opts: ServerOpts;
  connection: MessageConnection;
  evaluationResultCallbacks: { [key: number]: (res: EvaluationResult) => void };
  progressCallbacks: { [key: number]: ((res: ProgressMessage) => void) | undefined };
  nextCallback: number;
  nextProgress: number;
  child: cp.ChildProcess;

  constructor(config: QLConfigurationData, opts: ServerOpts) {
    this.opts = opts;
    const command = config.javaCommand;
    const jvmargs = ["-cp", path.resolve(config.qlDistributionPath, 'tools/odasa.jar'), 'com.semmle.api.server.CombinedServer'];
    const otherArgs = [];
    const args = jvmargs.concat(otherArgs);
    const child = cp.spawn(command, args);
    if (!child || !child.pid) {
      throw new Error(`Launching query server ${command} ${args} failed.`);
    }
    this.child = child;
    child.stderr.on('data', data => {
      this.log(`stderr: ${data}`);
    });
    child.on('close', (code) => {
      this.log(`child process exited with code ${code}`);
    });
    this.connection = createMessageConnection(child.stdout, child.stdin);
    this.connection.onRequest(completeQuery, res => {
      if (!(res.runId in this.evaluationResultCallbacks)) {
        this.log(`no callback associated with run id ${res.runId}, continuing without executing any callback`);
      }
      else {
        this.evaluationResultCallbacks[res.runId](res);
      }
      return {};
    })
    this.connection.onNotification(progress, res => {
      let callback = this.progressCallbacks[res.id];
      if (callback) {
        callback(res);
      }
    })
    this.connection.listen()
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

  unRegisterCallback(id: number) {
    delete this.evaluationResultCallbacks[id];
  }

  getPid(): number {
    return this.child.pid;
  }

  async sendRequest<P, R, E, RO>(type: RequestType<WithProgressId<P>, R, E, RO>, parameter: P, token?: CancellationToken, progress?: (res: ProgressMessage) => void): Promise<R> {
    let id = this.nextProgress++;
    this.progressCallbacks[id] = progress;
    try {
      return await this.connection.sendRequest(type, { body: parameter, progressId: id }, token);
    } finally {
      delete this.progressCallbacks[id];
    }
  }
}
