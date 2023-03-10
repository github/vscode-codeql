import { CommandManager } from "../../../../src/packages/commands";

describe(CommandManager.name, () => {
  it("can create a command manager", () => {
    const commandManager = new CommandManager();
    expect(commandManager).not.toBeUndefined();
  });
});
