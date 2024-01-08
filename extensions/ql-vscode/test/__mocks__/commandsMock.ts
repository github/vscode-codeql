import type { AppCommandManager } from "../../src/common/commands";
import type { CommandFunction } from "../../src/packages/commands";
import { CommandManager } from "../../src/packages/commands";
import type { Disposable } from "../../src/packages/commands/Disposable";

export function createMockCommandManager({
  registerCommand = jest.fn(),
  executeCommand = jest.fn(),
}: {
  registerCommand?: (commandName: string, fn: CommandFunction) => Disposable;
  executeCommand?: (commandName: string, ...args: any[]) => Promise<any>;
} = {}): AppCommandManager {
  return new CommandManager(registerCommand, executeCommand);
}
