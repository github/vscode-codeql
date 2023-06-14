import {
  NotificationLogger,
  showAndLogErrorMessage,
  ShowAndLogOptions,
} from "../logging";
import { RedactableError } from "../../pure/errors";
import { AppTelemetry } from "../telemetry";

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
  return showAndLogErrorMessage(logger, error.fullMessage, options);
}
