import type { Logger } from "../common/logging";
import type { ChildProcess } from "child_process";
import type { Disposable } from "vscode";
import type { MessageConnection } from "vscode-jsonrpc";

/** A running query server process and its associated message connection. */
export class ServerProcess implements Disposable {
  child: ChildProcess;
  connection: MessageConnection;
  logger: Logger;

  constructor(
    child: ChildProcess,
    connection: MessageConnection,
    private name: string,
    logger: Logger,
  ) {
    this.child = child;
    this.connection = connection;
    this.logger = logger;
  }

  dispose(): void {
    void this.logger.log(`Stopping ${this.name}...`);
    this.connection.dispose();
    this.connection.end();
    this.child.stdin!.end();
    this.child.stderr!.destroy();
    this.child.removeAllListeners();
    // TODO kill the process if it doesn't terminate after a certain time limit.

    // On Windows, we usually have to terminate the process before closing its stdout.
    this.child.stdout!.destroy();
    void this.logger.log(`Stopped ${this.name}.`);
  }
}
