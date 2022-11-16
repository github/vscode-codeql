import { Logger } from "./logging";
import * as cp from "child_process";
import { Disposable } from "vscode";
import { MessageConnection } from "vscode-jsonrpc";

/** A running query server process and its associated message connection. */
export class ServerProcess implements Disposable {
  child: cp.ChildProcess;
  connection: MessageConnection;
  logger: Logger;

  constructor(
    child: cp.ChildProcess,
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
    this.child.stdin!.end();
    this.child.stderr!.destroy();
    // TODO kill the process if it doesn't terminate after a certain time limit.

    // On Windows, we usually have to terminate the process before closing its stdout.
    this.child.stdout!.destroy();
    void this.logger.log(`Stopped ${this.name}.`);
  }
}
