import { window as Window, OutputChannel, Progress } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';

export interface Logger {
  /** Writes the given log message, followed by a newline. */
  log(message: string): void;
  /** Writes the given log message, not followed by a newline. */
  logWithoutTrailingNewline(message: string): void;
}

export type ProgressReporter = Progress<{ message: string }>;

/** A logger that writes messages to an output channel in the Output tab. */
export class OutputChannelLogger extends DisposableObject implements Logger {
  outputChannel: OutputChannel;

  constructor(title: string) {
    super();
    this.outputChannel = Window.createOutputChannel(title);
    this.push(this.outputChannel);
  }

  log(message: string) {
    this.outputChannel.appendLine(message);
  }

  logWithoutTrailingNewline(message: string) {
    this.outputChannel.append(message);
  }

}

/** The global logger for the extension. */
export const logger = new OutputChannelLogger('CodeQL Extension Log');

/** The logger for messages from the query server. */
export const queryServerLogger = new OutputChannelLogger('CodeQL Query Server');

/** The logger for messages from the language server. */
export const ideServerLogger = new OutputChannelLogger('CodeQL Language Server');
