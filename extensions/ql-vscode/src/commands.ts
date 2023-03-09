import { commands } from "vscode";
import { commandRunner } from "./commandRunner";
import { CommandFunction, CommandManager } from "./packages/commands";

export function initializeVSCodeCommandManager<
  Commands extends Record<string, CommandFunction>,
>(): CommandManager<Commands> {
  return new CommandManager(commandRunner, wrappedExecuteCommand);
}

async function wrappedExecuteCommand<
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

export type ExtensionCommands = {
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
};
export type AllCommands = ExtensionCommands;
