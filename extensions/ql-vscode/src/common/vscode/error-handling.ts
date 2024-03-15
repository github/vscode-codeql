import {
  showAndLogWarningMessage,
  showAndLogExceptionWithTelemetry,
} from "../logging";
import type { NotificationLogger } from "../logging";
import { extLogger } from "../logging/vscode";
import type { AppTelemetry } from "../telemetry";
import { telemetryListener } from "./telemetry";
import { asError, getErrorMessage } from "../helpers-pure";
import { redactableError } from "../errors";
import { UserCancellationException } from "./progress";
import { CliError } from "../../codeql-cli/cli-errors";
import { EOL } from "os";

/**
 * Executes a task with error handling. It provides a uniform way to handle errors.
 *
 * @template T - A function type that takes an unknown number of arguments and returns a Promise.
 * @param {T} task - The task to be executed.
 * @param {NotificationLogger} [logger=extLogger] - The logger to use for error reporting.
 * @param {AppTelemetry | undefined} [telemetry=telemetryListener] - The telemetry listener to use for error reporting.
 * @param {string} [commandId] - The optional command id associated with the task.
 * @param {...unknown} args - The arguments to be passed to the task.
 * @returns {Promise<unknown>} The result of the task, or undefined if an error occurred.
 * @throws {Error} If an error occurs during the execution of the task.
 */
export async function runWithErrorHandling<
  T extends (...args: unknown[]) => Promise<unknown>,
>(
  task: T,
  logger: NotificationLogger = extLogger,
  telemetry: AppTelemetry | undefined = telemetryListener,
  commandId?: string,
  ...args: unknown[]
): Promise<unknown> {
  const startTime = Date.now();
  let error: Error | undefined;

  try {
    return await task(...args);
  } catch (e) {
    error = asError(e);
    const errorMessage = redactableError(error)`${
      getErrorMessage(e) || e
    }${commandId ? ` (${commandId})` : ""}`;

    const extraTelemetryProperties = commandId
      ? { command: commandId }
      : undefined;

    if (e instanceof UserCancellationException) {
      // User has cancelled this action manually
      if (e.silent) {
        void logger.log(errorMessage.fullMessage);
      } else {
        void showAndLogWarningMessage(logger, errorMessage.fullMessage);
      }
    } else if (e instanceof CliError) {
      const fullMessage = `${e.commandDescription} failed with args:${EOL}    ${e.commandArgs.join(" ")}${EOL}${
        e.stderr ?? e.cause
      }`;
      void showAndLogExceptionWithTelemetry(logger, telemetry, errorMessage, {
        fullMessage,
        extraTelemetryProperties,
      });
    } else {
      // Include the full stack in the error log only.
      const fullMessage = errorMessage.fullMessageWithStack;
      void showAndLogExceptionWithTelemetry(logger, telemetry, errorMessage, {
        fullMessage,
        extraTelemetryProperties,
      });
    }
    return undefined;
  } finally {
    if (commandId) {
      const executionTime = Date.now() - startTime;
      telemetryListener?.sendCommandUsage(commandId, executionTime, error);
    }
  }
}
