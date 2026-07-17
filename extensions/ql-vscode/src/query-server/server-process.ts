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

    // `dispose()` is synchronous, so we only signal the process to stop (by
    // closing its streams) and don't wait for it to actually exit. Callers that
    // need the process to have terminated — e.g. before starting a replacement
    // server — should await `waitForExit()` afterwards.

    // On Windows, we usually have to terminate the process before closing its stdout.
    this.child.stdout!.destroy();
    void this.logger.log(`Stopped ${this.name}.`);
  }

  /**
   * Waits for the underlying child process to fully exit, forcibly killing it
   * after `timeoutMs` if it has not exited on its own.
   *
   * Call this after `dispose()` when you need the OS to have actually released
   * the process before continuing. This matters on Windows, where the OS can
   * keep file locks (for example on the database or disk cache) until the
   * process has terminated — so starting a replacement server before the old
   * one has exited can intermittently fail.
   */
  async waitForExit(timeoutMs = 5000): Promise<void> {
    const hasExited = () =>
      this.child.exitCode !== null || this.child.signalCode !== null;

    if (hasExited()) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        void this.logger.log(
          `${this.name} did not exit within ${timeoutMs}ms; killing it.`,
        );
        this.child.kill("SIGKILL");
        resolve();
      }, timeoutMs);

      const done = () => {
        clearTimeout(timer);
        resolve();
      };

      this.child.once("exit", done);

      // Guard against the process having exited between the check above and
      // attaching the listener.
      if (hasExited()) {
        this.child.removeListener("exit", done);
        done();
      }
    });
  }
}
