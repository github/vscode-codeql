import { AppCommandManager } from "../../src/common/commands";
import { CommandFunction, CommandManager } from "../../src/packages/commands";
import { Disposable } from "../../src/packages/commands/Disposable";

export function createMockCommandManager({
  registerCommand = jest.fn(),
  executeCommand = jest.fn(),
}: {
  registerCommand?: (commandName: string, fn: CommandFunction) => Disposable;
  executeCommand?: (commandName: string, ...args: any[]) => Promise<any>;
} = {}): AppCommandManager {
  return new CommandManager(registerCommand, executeCommand);
}
