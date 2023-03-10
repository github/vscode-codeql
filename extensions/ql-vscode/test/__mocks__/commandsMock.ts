import { ExtensionCommandManager } from "../../src/common/commands";
import {
  CommandFunction,
  CommandManager,
  Disposable,
} from "../../src/packages/commands";

export function createMockCommandManager({
  registerCommand = jest.fn(),
  executeCommand = jest.fn(),
}: {
  registerCommand?: (commandName: string, fn: CommandFunction) => Disposable;
  executeCommand?: (commandName: string, ...args: any[]) => Promise<any>;
} = {}): ExtensionCommandManager {
  return new CommandManager(registerCommand, executeCommand);
}
