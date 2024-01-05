import type { NotificationLogger } from "./notification-logger";
import type { AppTelemetry } from "../telemetry";
import type { RedactableError } from "../errors";

interface ShowAndLogOptions {
  /**
   * An alternate message that is added to the log, but not displayed in the popup.
   * This is useful for adding extra detail to the logs that would be too noisy for the popup.
   */
  fullMessage?: string;
}

/**
 * Show an error message and log it to the console
 *
 * @param logger The logger that will receive the message.
 * @param message The message to show.
 * @param options? See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogErrorMessage(
  logger: NotificationLogger,
  message: string,
  options?: ShowAndLogOptions,
): Promise<void> {
  return internalShowAndLog(
    logger,
    dropLinesExceptInitial(message),
    logger.showErrorMessage,
    { fullMessage: message, ...options },
  );
}

function dropLinesExceptInitial(message: string, n = 2) {
  return message.toString().split(/\r?\n/).slice(0, n).join("\n");
}

/**
 * Show a warning message and log it to the console
 *
 * @param logger The logger that will receive the message.
 * @param message The message to show.
 * @param options? See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogWarningMessage(
  logger: NotificationLogger,
  message: string,
  options?: ShowAndLogOptions,
): Promise<void> {
  return internalShowAndLog(
    logger,
    message,
    logger.showWarningMessage,
    options,
  );
}

/**
 * Show an information message and log it to the console
 *
 * @param logger The logger that will receive the message.
 * @param message The message to show.
 * @param options? See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogInformationMessage(
  logger: NotificationLogger,
  message: string,
  options?: ShowAndLogOptions,
): Promise<void> {
  return internalShowAndLog(
    logger,
    message,
    logger.showInformationMessage,
    options,
  );
}

async function internalShowAndLog(
  logger: NotificationLogger,
  message: string,
  fn: (message: string) => Promise<void>,
  { fullMessage }: ShowAndLogOptions = {},
): Promise<void> {
  void logger.log(fullMessage || message);
  await fn.bind(logger)(message);
}

interface ShowAndLogExceptionOptions extends ShowAndLogOptions {
  /** Custom properties to include in the telemetry report. */
  extraTelemetryProperties?: { [key: string]: string };
}

/**
 * Show an error message, log it to the console, and emit redacted information as telemetry
 *
 * @param logger The logger that will receive the message.
 * @param telemetry The telemetry instance to use for reporting.
 * @param error The error to show. Only redacted information will be included in the telemetry.
 * @param options See individual fields on `ShowAndLogExceptionOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogExceptionWithTelemetry(
  logger: NotificationLogger,
  telemetry: AppTelemetry | undefined,
  error: RedactableError,
  options: ShowAndLogExceptionOptions = {},
): Promise<void> {
  telemetry?.sendError(error, options.extraTelemetryProperties);
  return showAndLogErrorMessage(logger, error.fullMessageWithStack, options);
}
