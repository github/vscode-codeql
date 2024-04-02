import { ensureFile } from "fs-extra";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { isAbsolute } from "path";
import { getErrorMessage } from "../helpers-pure";
import type { Logger, LogOptions } from "./logger";
import type { Disposable } from "../disposable-object";

/**
 * An implementation of {@link Logger} that sends the output both to another {@link Logger}
 * and to a file.
 *
 * The first time a message is written, an additional banner is written to the underlying logger
 * pointing the user to the "side log" file.
 */
export class TeeLogger implements Logger, Disposable {
  private emittedRedirectMessage = false;
  private error = false;
  private fileHandle: FileHandle | undefined = undefined;

  public constructor(
    private readonly logger: Logger,
    private readonly location: string,
  ) {
    if (!isAbsolute(location)) {
      throw new Error(
        `Additional Log Location must be an absolute path: ${location}`,
      );
    }
  }

  async log(message: string, options = {} as LogOptions): Promise<void> {
    if (!this.emittedRedirectMessage) {
      this.emittedRedirectMessage = true;
      const msg = `| Log being saved to ${this.location} |`;
      const separator = new Array(msg.length).fill("-").join("");
      await this.logger.log(separator);
      await this.logger.log(msg);
      await this.logger.log(separator);
    }

    if (!this.error) {
      try {
        if (!this.fileHandle) {
          await ensureFile(this.location);

          this.fileHandle = await open(this.location, "a");
        }

        const trailingNewline = options.trailingNewline ?? true;

        await this.fileHandle.appendFile(
          message + (trailingNewline ? "\n" : ""),
          {
            encoding: "utf8",
          },
        );
      } catch (e) {
        // Write an error message to the primary log, and stop trying to write to the side log.
        this.error = true;
        try {
          await this.fileHandle?.close();
        } catch (e) {
          void this.logger.log(
            `Failed to close file handle: ${getErrorMessage(e)}`,
          );
        }
        this.fileHandle = undefined;
        const errorMessage = getErrorMessage(e);
        await this.logger.log(
          `Error writing to additional log file: ${errorMessage}`,
        );
      }
    }

    if (!this.error) {
      await this.logger.log(message, options);
    }
  }

  show(preserveFocus?: boolean): void {
    this.logger.show(preserveFocus);
  }

  dispose(): void {
    try {
      void this.fileHandle?.close();
    } catch (e) {
      void this.logger.log(
        `Failed to close file handle: ${getErrorMessage(e)}`,
      );
    }
    this.fileHandle = undefined;
  }
}
