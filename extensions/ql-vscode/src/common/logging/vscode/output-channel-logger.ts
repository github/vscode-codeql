import type { OutputChannel, Progress } from "vscode";
import { window as Window } from "vscode";
import type { Logger, LogOptions } from "../logger";
import { DisposableObject } from "../../disposable-object";
import type { NotificationLogger } from "../notification-logger";

/**
 * A logger that writes messages to an output channel in the VS Code Output tab.
 */
export class OutputChannelLogger
  extends DisposableObject
  implements Logger, NotificationLogger
{
  public readonly outputChannel: OutputChannel;
  isCustomLogDirectory: boolean;

  constructor(title: string) {
    super();
    this.outputChannel = Window.createOutputChannel(title);
    this.push(this.outputChannel);
    this.isCustomLogDirectory = false;
  }

  async log(message: string, options = {} as LogOptions): Promise<void> {
    try {
      if (options.trailingNewline === undefined) {
        options.trailingNewline = true;
      }
      if (options.trailingNewline) {
        this.outputChannel.appendLine(message);
      } else {
        this.outputChannel.append(message);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Channel has been closed") {
        // Output channel is closed logging to console instead
        console.log(
          "Output channel is closed logging to console instead:",
          message,
        );
      } else {
        throw e;
      }
    }
  }

  show(preserveFocus?: boolean): void {
    this.outputChannel.show(preserveFocus);
  }

  async showErrorMessage(message: string): Promise<void> {
    await this.showMessage(message, Window.showErrorMessage);
  }

  async showInformationMessage(message: string): Promise<void> {
    await this.showMessage(message, Window.showInformationMessage);
  }

  async showWarningMessage(message: string): Promise<void> {
    await this.showMessage(message, Window.showWarningMessage);
  }

  private async showMessage(
    message: string,
    show: (message: string, ...items: string[]) => Thenable<string | undefined>,
  ): Promise<void> {
    const label = "View extension logs";
    const result = await show(message, label);

    if (result === label) {
      this.show();
    }
  }
}

export type ProgressReporter = Progress<{ message: string }>;
