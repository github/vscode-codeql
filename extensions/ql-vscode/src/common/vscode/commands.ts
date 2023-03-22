import { commands } from "vscode";
import { commandRunner, NoProgressTask } from "../../commandRunner";
import { CommandFunction, CommandManager } from "../../packages/commands";
import { OutputChannelLogger } from "../logging";

/**
 * Create a command manager for VSCode, wrapping the commandRunner
 * and vscode.executeCommand.
 */
export function createVSCodeCommandManager<
  Commands extends Record<string, CommandFunction>,
>(outputLogger?: OutputChannelLogger): CommandManager<Commands> {
  return new CommandManager((commandId, task: NoProgressTask) => {
    return commandRunner(commandId, task, outputLogger);
  }, wrapExecuteCommand);
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
