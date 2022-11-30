export interface LogOptions {
  /** If false, don't output a trailing newline for the log entry. Default true. */
  trailingNewline?: boolean;

  /** If specified, add this log entry to the log file at the specified location. */
  additionalLogLocation?: string;
}

export interface Logger {
  /** Writes the given log message, optionally followed by a newline. */
  log(message: string, options?: LogOptions): Promise<void>;
  /**
   * Reveal this channel in the UI.
   *
   * @param preserveFocus When `true` the channel will not take focus.
   */
  show(preserveFocus?: boolean): void;

  /**
   * Remove the log at the specified location
   * @param location log to remove
   */
  removeAdditionalLogLocation(location: string | undefined): void;
}
