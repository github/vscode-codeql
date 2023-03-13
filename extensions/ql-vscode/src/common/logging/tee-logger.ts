import { appendFile, ensureFile } from "fs-extra";
import { isAbsolute } from "path";
import { Logger, LogOptions } from "./logger";

/**
 * An implementation of {@link Logger} that sends the output both to another {@link Logger}
 * and to a file.
 *
 * The first time a message is written, an additional banner is written to the underlying logger
 * pointing the user to the "side log" file.
 */
export class TeeLogger implements Logger {
  private emittedRedirectMessage = false;

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

    const trailingNewline = options.trailingNewline ?? true;
    await ensureFile(this.location);

    await appendFile(this.location, message + (trailingNewline ? "\n" : ""), {
      encoding: "utf8",
    });

    await this.logger.log(message, options);
  }

  show(preserveFocus?: boolean): void {
    this.logger.show(preserveFocus);
  }
}
