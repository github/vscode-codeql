/**
 * Contains a generic implementation of typed commands.
 *
 * This allows different parts of the extension to register commands with a certain type,
 * and then allow other parts to call those commands in a well-typed manner.
 */

import type { Disposable } from "./Disposable";

/**
 * A command function is a completely untyped command.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommandFunction = (...args: any[]) => Promise<unknown>;

/**
 * The command manager basically takes a single input, the type
 * of all the known commands. The second parameter is provided by
 * default (and should not be needed by the caller) it is a
 * technicality to allow the type system to look up commands.
 */
export class CommandManager<
  Commands extends Record<string, CommandFunction>,
  CommandName extends keyof Commands & string = keyof Commands & string,
> implements Disposable
{
  private commands: Disposable[] = [];

  constructor(
    private readonly commandRegister: <T extends CommandName>(
      commandName: T,
      fn: NonNullable<Commands[T]>,
    ) => Disposable,
    private readonly commandExecute: <T extends CommandName>(
      commandName: T,
      ...args: Parameters<Commands[T]>
    ) => Promise<Awaited<ReturnType<Commands[T]>>>,
  ) {}

  /**
   * Register a command with the specified name and implementation.
   */
  register<T extends CommandName>(
    commandName: T,
    definition: NonNullable<Commands[T]>,
  ): void {
    this.commands.push(this.commandRegister(commandName, definition));
  }

  /**
   * Execute a command with the specified name and the provided arguments.
   */
  execute<T extends CommandName>(
    commandName: T,
    ...args: Parameters<Commands[T]>
  ): Promise<Awaited<ReturnType<Commands[T]>>> {
    return this.commandExecute(commandName, ...args);
  }

  /**
   * Dispose the manager, disposing all the registered commands.
   */
  dispose(): void {
    this.commands.forEach((cmd) => {
      cmd.dispose();
    });
    this.commands = [];
  }
}
