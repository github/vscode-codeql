import { commands, Disposable } from "vscode";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "./helpers";
import { extLogger } from "./common";
import { asError, getErrorMessage, getErrorStack } from "./pure/helpers-pure";
import { telemetryListener } from "./telemetry";
import { redactableError } from "./pure/errors";
import { UserCancellationException } from "./progress";

/**
 * A task that handles command invocations from `commandRunner`.
 * Arguments passed to the command handler are passed along,
 * untouched to this `NoProgressTask` instance.
 *
 * @param args arguments passed to this task passed on from
 * `commands.registerCommand`.
 */
export type NoProgressTask = (...args: any[]) => Promise<any>;

/**
 * A generic wrapper for command registration. This wrapper adds uniform error handling for commands.
 *
 * In this variant of the command runner, no progress monitor is used.
 *
 * @param commandId The ID of the command to register.
 * @param task The task to run. It is passed directly to `commands.registerCommand`. Any
 * arguments to the command handler are passed on to the task.
 */
export function commandRunner(
  commandId: string,
  task: NoProgressTask,
  outputLogger = extLogger,
): Disposable {
  return commands.registerCommand(commandId, async (...args: any[]) => {
    const startTime = Date.now();
    let error: Error | undefined;

    try {
      return await task(...args);
    } catch (e) {
      error = asError(e);
      const errorMessage = redactableError(error)`${
        getErrorMessage(e) || e
      } (${commandId})`;
      const errorStack = getErrorStack(e);
      if (e instanceof UserCancellationException) {
        // User has cancelled this action manually
        if (e.silent) {
          void outputLogger.log(errorMessage.fullMessage);
        } else {
          void showAndLogWarningMessage(errorMessage.fullMessage, {
            outputLogger,
          });
        }
      } else {
        // Include the full stack in the error log only.
        const fullMessage = errorStack
          ? `${errorMessage.fullMessage}\n${errorStack}`
          : errorMessage.fullMessage;
        void showAndLogExceptionWithTelemetry(errorMessage, {
          outputLogger,
          fullMessage,
          extraTelemetryProperties: {
            command: commandId,
          },
        });
      }
      return undefined;
    } finally {
      const executionTime = Date.now() - startTime;
      telemetryListener?.sendCommandUsage(commandId, executionTime, error);
    }
  });
}
