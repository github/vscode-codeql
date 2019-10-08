import { window as Window, OutputChannel } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';

export interface Logger {
  /** Writes the given log message, followed by a newline. */
  log(message: string): void;
  /** Writes the given log message, not followed by a newline. */
  logWithoutTrailingNewline?(message: string): void;
}

/** A logger that writes messages to an output channel in the Output tab. */
export class OutputChannelLogger extends DisposableObject implements Logger {
  _outputChannel: OutputChannel;

  constructor(title: string) {
    super();
    this._outputChannel = Window.createOutputChannel(title);
    this.push(this._outputChannel);
  }

  log(message: string) {
    this._outputChannel.appendLine(message);
  }

  logWithoutTrailingNewline(message: string) {
    this._outputChannel.append(message);
  }

}

/** The global logger for the extension. */
export const logger = new OutputChannelLogger('QL Extension Log');

/** The logger for messages from the query server. */
export const queryServerLogger = new OutputChannelLogger('QL Query Server');

/** The logger for messages from the language server. */
export const ideServerLogger = new OutputChannelLogger('QL Language Server');
