import { CommandFunction, CommandManager } from "../../src/packages/commands";
import { Disposable } from "../../src/packages/commands/Disposable";

export function createMockCommandManager<
  Commands extends Record<string, CommandFunction>,
>({
  registerCommand = jest.fn(),
  executeCommand = jest.fn(),
}: {
  registerCommand?: (commandName: string, fn: CommandFunction) => Disposable;
  executeCommand?: (commandName: string, ...args: any[]) => Promise<any>;
} = {}): CommandManager<Commands> {
  return new CommandManager<Commands>(registerCommand, executeCommand);
}
