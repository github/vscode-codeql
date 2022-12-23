import { join } from "path";
import { readJsonSync } from "fs-extra";

type CmdDecl = {
  command: string;
  when?: string;
  title?: string;
};

describe("commands declared in package.json", () => {
  const manifest = readJsonSync(join(__dirname, "../../package.json"));
  const commands = manifest.contributes.commands;
  const menus = manifest.contributes.menus;

  const disabledInPalette: Set<string> = new Set<string>();

  // These commands should appear in the command palette, and so
  // should be prefixed with 'CodeQL: '.
  const paletteCmds: Set<string> = new Set<string>();

  // These commands arising on context menus in non-CodeQL controlled
  // panels, (e.g. file browser) and so should be prefixed with 'CodeQL: '.
  const contribContextMenuCmds: Set<string> = new Set<string>();

  // These are commands used in CodeQL controlled panels, and so don't need any prefixing in their title.
  const scopedCmds: Set<string> = new Set<string>();
  const commandTitles: { [cmd: string]: string } = {};

  commands.forEach((commandDecl: CmdDecl) => {
    const { command, title } = commandDecl;
    if (command.match(/^codeQL\./) || command.match(/^codeQLQueryResults\./)) {
      paletteCmds.add(command);
      expect(title).toBeDefined();
      commandTitles[command] = title!;
    } else if (
      command.match(/^codeQLDatabases\./) ||
      command.match(/^codeQLDatabasesExperimental\./) ||
      command.match(/^codeQLQueryHistory\./) ||
      command.match(/^codeQLAstViewer\./) ||
      command.match(/^codeQLEvalLogViewer\./) ||
      command.match(/^codeQLTests\./)
    ) {
      scopedCmds.add(command);
      expect(title).toBeDefined();
      commandTitles[command] = title!;
    } else {
      fail(`Unexpected command name ${command}`);
    }
  });

  menus["explorer/context"].forEach((commandDecl: CmdDecl) => {
    const { command } = commandDecl;
    paletteCmds.delete(command);
    contribContextMenuCmds.add(command);
  });

  menus["editor/context"].forEach((commandDecl: CmdDecl) => {
    const { command } = commandDecl;
    paletteCmds.delete(command);
    contribContextMenuCmds.add(command);
  });

  menus.commandPalette.forEach((commandDecl: CmdDecl) => {
    if (commandDecl.when === "false")
      disabledInPalette.add(commandDecl.command);
  });

  it("should have commands appropriately prefixed", () => {
    paletteCmds.forEach((command) => {
      // command ${command} should be prefixed with 'CodeQL: ', since it is accessible from the command palette
      expect(commandTitles[command]).toMatch(/^CodeQL: /);
    });

    contribContextMenuCmds.forEach((command) => {
      // command ${command} should be prefixed with 'CodeQL: ', since it is accessible from a context menu in a non-extension-controlled context
      expect(commandTitles[command]).toMatch(/^CodeQL: /);
    });

    scopedCmds.forEach((command) => {
      // command ${command} should not be prefixed with 'CodeQL: ', since it is accessible from an extension-controlled context
      expect(commandTitles[command]).not.toMatch(/^CodeQL: /);
    });
  });

  it("should have the right commands accessible from the command palette", () => {
    paletteCmds.forEach((command) => {
      // command ${command} should be enabled in the command palette
      expect(disabledInPalette.has(command)).toBe(false);
    });

    // Commands in contribContextMenuCmds may reasonbly be enabled or
    // disabled in the command palette; for example, codeQL.runQuery
    // is available there, since we heuristically figure out which
    // query to run, but codeQL.setCurrentDatabase is not.

    scopedCmds.forEach((command) => {
      // command ${command} should be disabled in the command palette
      expect(disabledInPalette.has(command)).toBe(true);
    });
  });
});
