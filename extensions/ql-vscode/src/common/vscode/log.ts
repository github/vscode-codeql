import { window } from "vscode";
import { RedactableError } from "../../pure/errors";
import { telemetryListener } from "../../telemetry";
import { extLogger, OutputChannelLogger } from "../logging";

interface ShowAndLogExceptionOptions extends ShowAndLogOptions {
  /** Custom properties to include in the telemetry report. */
  extraTelemetryProperties?: { [key: string]: string };
}

interface ShowAndLogOptions {
  /** The output logger that will receive the message. */
  outputLogger?: OutputChannelLogger;
  /** A set of items that will be rendered as actions in the message. */
  items?: string[];
  /**
   * An alternate message that is added to the log, but not displayed in the popup.
   * This is useful for adding extra detail to the logs that would be too noisy for the popup.
   */
  fullMessage?: string;
}

/**
 * Show an error message, log it to the console, and emit redacted information as telemetry
 *
 * @param error The error to show. Only redacted information will be included in the telemetry.
 * @param options See individual fields on `ShowAndLogExceptionOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogExceptionWithTelemetry(
  error: RedactableError,
  options: ShowAndLogExceptionOptions = {},
): Promise<string | undefined> {
  telemetryListener?.sendError(error, options.extraTelemetryProperties);
  return showAndLogErrorMessage(error.fullMessage, options);
}

/**
 * Show an error message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogErrorMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(
    dropLinesExceptInitial(message),
    window.showErrorMessage,
    { fullMessage: message, ...options },
  );
}

function dropLinesExceptInitial(message: string, n = 2) {
  return message.toString().split(/\r?\n/).slice(0, n).join("\n");
}

/**
 * Show a warning message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogWarningMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, window.showWarningMessage, options);
}

/**
 * Show an information message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogInformationMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, window.showInformationMessage, options);
}

type ShowMessageFn = (
  message: string,
  ...items: string[]
) => Thenable<string | undefined>;

async function internalShowAndLog(
  message: string,
  fn: ShowMessageFn,
  { items = [], outputLogger = extLogger, fullMessage }: ShowAndLogOptions = {},
): Promise<string | undefined> {
  const label = "Show Log";
  void outputLogger.log(fullMessage || message);
  const result = await fn(message, label, ...items);
  if (result === label) {
    outputLogger.show();
  }
  return result;
}
