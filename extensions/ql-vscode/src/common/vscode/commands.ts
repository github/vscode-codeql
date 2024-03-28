import type { Disposable } from "vscode";
import { commands } from "vscode";
import type { CommandFunction } from "../../packages/commands";
import { CommandManager } from "../../packages/commands";
import type { NotificationLogger } from "../logging";
import { extLogger } from "../logging/vscode";
import { telemetryListener } from "./telemetry";
import type { AppTelemetry } from "../telemetry";
import { runWithErrorHandling } from "./error-handling";

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
export function registerCommandWithErrorHandling<
  T extends (...args: unknown[]) => Promise<unknown>,
>(
  commandId: string,
  task: T,
  logger: NotificationLogger = extLogger,
  telemetry: AppTelemetry | undefined = telemetryListener,
): Disposable {
  return commands.registerCommand(commandId, async (...args: Parameters<T>) =>
    runWithErrorHandling(task, logger, telemetry, commandId, ...args),
  );
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
