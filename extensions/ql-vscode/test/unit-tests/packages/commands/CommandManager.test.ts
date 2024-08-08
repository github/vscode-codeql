import type { CommandFunction } from "../../../../src/packages/commands";
import { CommandManager } from "../../../../src/packages/commands";

describe("CommandManager", () => {
  it("can register a command", () => {
    const commandRegister = jest.fn();
    const commandManager = new CommandManager<Record<string, CommandFunction>>(
      commandRegister,
      jest.fn(),
    );
    const myCommand = jest.fn();
    commandManager.register("abc", myCommand);
    expect(commandRegister).toHaveBeenCalledTimes(1);
    expect(commandRegister).toHaveBeenCalledWith("abc", myCommand);
  });

  it("can register typed commands", async () => {
    const commandManager = new CommandManager<{
      "codeQL.openVariantAnalysisLogs": (
        variantAnalysisId: number,
      ) => Promise<number>;
    }>(jest.fn(), jest.fn());

    // @ts-expect-error wrong command name should give a type error
    commandManager.register("abc", jest.fn());

    commandManager.register(
      "codeQL.openVariantAnalysisLogs",
      // @ts-expect-error wrong function parameter type should give a type error
      async (variantAnalysisId: string): Promise<number> => 10,
    );

    commandManager.register(
      "codeQL.openVariantAnalysisLogs",
      // @ts-expect-error wrong function return type should give a type error
      async (variantAnalysisId: number): Promise<string> => "hello",
    );

    // Working types
    commandManager.register(
      "codeQL.openVariantAnalysisLogs",
      async (variantAnalysisId: number): Promise<number> =>
        variantAnalysisId * 10,
    );
  });

  it("can dispose of its commands", () => {
    const dispose1 = jest.fn();
    const dispose2 = jest.fn();
    const commandRegister = jest
      .fn()
      .mockReturnValueOnce({ dispose: dispose1 })
      .mockReturnValueOnce({ dispose: dispose2 });
    const commandManager = new CommandManager<Record<string, CommandFunction>>(
      commandRegister,
      jest.fn(),
    );
    commandManager.register("abc", jest.fn());
    commandManager.register("def", jest.fn());
    expect(dispose1).not.toHaveBeenCalled();
    expect(dispose2).not.toHaveBeenCalled();
    commandManager.dispose();
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
  });

  it("can execute a command", async () => {
    const commandExecute = jest.fn().mockReturnValue(7);
    const commandManager = new CommandManager<Record<string, CommandFunction>>(
      jest.fn(),
      commandExecute,
    );
    const result = await commandManager.execute("abc", "hello", true);
    expect(result).toEqual(7);
    expect(commandExecute).toHaveBeenCalledTimes(1);
    expect(commandExecute).toHaveBeenCalledWith("abc", "hello", true);
  });

  it("can execute typed commands", async () => {
    const commandManager = new CommandManager<{
      "codeQL.openVariantAnalysisLogs": (
        variantAnalysisId: number,
      ) => Promise<number>;
    }>(jest.fn(), jest.fn());

    // @ts-expect-error wrong command name should give a type error
    await commandManager.execute("abc", 4);

    await commandManager.execute(
      "codeQL.openVariantAnalysisLogs",
      // @ts-expect-error wrong argument type should give a type error
      "xyz",
    );

    // @ts-expect-error wrong number of arguments should give a type error
    await commandManager.execute("codeQL.openVariantAnalysisLogs", 2, 3);

    // Working types
    await commandManager.execute("codeQL.openVariantAnalysisLogs", 7);
  });
});
