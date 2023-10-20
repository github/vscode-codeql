import { commands, Disposable } from "vscode";
import { CommandFunction, CommandManager } from "../../packages/commands";
import {
  NotificationLogger,
  showAndLogWarningMessage,
  showAndLogExceptionWithTelemetry,
} from "../logging";
import { extLogger } from "../logging/vscode";
import { asError, getErrorMessage } from "../../common/helpers-pure";
import { redactableError } from "../../common/errors";
import { UserCancellationException } from "./progress";
import { telemetryListener } from "./telemetry";
import { AppTelemetry } from "../telemetry";

/**
 * Create a command manager for VSCode, wrapping registerCommandWithErrorHandling
 * and vscode.executeCommand.
 */
export function createVSCodeCommandManager<
  Commands extends Record<string, CommandFunction>,
>(
  logger?: NotificationLogger,
  telemetry?: AppTelemetry,
): CommandManager<Commands> {
  return new CommandManager((commandId, task) => {
    return registerCommandWithErrorHandling(commandId, task, logger, telemetry);
  }, wrapExecuteCommand);
}

/**
 * A wrapper for command registration. This wrapper adds uniform error handling for commands.
 *
 * @param commandId The ID of the command to register.
 * @param task The task to run. It is passed directly to `commands.registerCommand`. Any
 * arguments to the command handler are passed on to the task.
 * @param logger The logger to use for error reporting.
 * @param telemetry The telemetry listener to use for error reporting.
 */
export function registerCommandWithErrorHandling(
  commandId: string,
  task: (...args: any[]) => Promise<any>,
  logger: NotificationLogger = extLogger,
  telemetry: AppTelemetry | undefined = telemetryListener,
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
      if (e instanceof UserCancellationException) {
        // User has cancelled this action manually
        if (e.silent) {
          void logger.log(errorMessage.fullMessage);
        } else {
          void showAndLogWarningMessage(logger, errorMessage.fullMessage);
        }
      } else {
        // Include the full stack in the error log only.
        const fullMessage = errorMessage.fullMessageWithStack;
        void showAndLogExceptionWithTelemetry(logger, telemetry, errorMessage, {
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

/**
 * wrapExecuteCommand wraps commands.executeCommand to satisfy that the
 * type is a Promise. Type script does not seem to be smart enough
 * to figure out that `ReturnType<Commands[CommandName]>` is actually
 * a Promise, so we need to add a second layer of wrapping and unwrapping
 * (The `Promise<Awaited<` part) to get the right types.
 */
async function wrapExecuteCommand<
  Commands extends Record<string, CommandFunction>,
  CommandName extends keyof Commands & string = keyof Commands & string,
>(
  commandName: CommandName,
  ...args: Parameters<Commands[CommandName]>
): Promise<Awaited<ReturnType<Commands[CommandName]>>> {
  return await commands.executeCommand<
    Awaited<ReturnType<Commands[CommandName]>>
  >(commandName, ...args);
}
