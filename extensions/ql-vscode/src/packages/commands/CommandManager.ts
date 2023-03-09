export interface Disposable {
  dispose(): void;
}

export type CommandFunction = (...args: any[]) => Promise<unknown>;

export class CommandManager<
  Commands extends Record<string, CommandFunction>,
  CommandName extends keyof Commands & string = keyof Commands & string,
> implements Disposable
{
  // TODO: should this be a map?
  // TODO: handle multiple command names
  private commands: Disposable[] = [];

  constructor(
    private readonly commandRegister: <T extends CommandName>(
      commandName: T,
      definition: Commands[T],
    ) => Disposable,
    private readonly commandExecute: <T extends CommandName>(
      commandName: T,
      ...args: Parameters<Commands[T]>
    ) => Promise<ReturnType<Commands[T]>>,
  ) {}

  registerCommand<T extends CommandName>(
    commandName: T,
    definition: Commands[T],
  ): void {
    this.commands.push(this.commandRegister(commandName, definition));
  }

  executeCommand<T extends CommandName>(
    commandName: T,
    ...args: Parameters<Commands[T]>
  ): Promise<ReturnType<Commands[T]>> {
    return this.commandExecute(commandName, ...args);
  }

  dispose(): void {
    this.commands.forEach((cmd) => {
      cmd.dispose();
    });
    this.commands = [];
  }
}
