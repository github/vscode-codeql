/**
 * @name A VS Code command should not be used in multiple locations
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/unique-command-use
 * @description Using each VS Code command from only one location makes
 * our telemetry more useful, because we can differentiate more user
 * interactions and know which features of the UI our users are using.
 * To fix this alert, new commands will need to be made so that each one
 * is only used from one location. The commands should share the same
 * implementation so we do not introduce duplicate code.
 * When fixing this alert, search the codebase for all other references
 * to the command name. The location of the alert is an arbitrarily
 * chosen usage of the command, and may not necessarily be the location
 * that should be changed to fix the alert.
 */

import javascript

/**
 * The name of a VS Code command.
 */
class CommandName extends string {
  CommandName() { exists(CommandUsage e | e.getCommandName() = this) }

  /**
   * In how many ways is this command used. Will always be at least 1.
   */
  int getNumberOfUsages() { result = count(this.getAUse()) }

  /**
   * Get a usage of this command.
   */
  CommandUsage getAUse() { result.getCommandName() = this }

  /**
   * Get the canonical first usage of this command, to use for the location
   * of the alert. The implementation of this ordering of usages is arbitrary
   * and the usage given may not be the one that should be changed when fixing
   * the alert.
   */
  CommandUsage getFirstUsage() {
    result =
      max(CommandUsage use |
        use = this.getAUse()
      |
        use
        order by
          use.getFile().getRelativePath(), use.getLocation().getStartLine(),
          use.getLocation().getStartColumn()
      )
  }
}

/**
 * Matches one of the members of `BuiltInVsCodeCommands` from `extensions/ql-vscode/src/common/commands.ts`.
 */
class BuiltInVSCodeCommand extends string {
  BuiltInVSCodeCommand() {
    exists(TypeAliasDeclaration tad |
      tad.getIdentifier().getName() = "BuiltInVsCodeCommands" and
      tad.getDefinition().(InterfaceTypeExpr).getAMember().getName() = this
    )
  }
}

/**
 * Represents a single usage of a command, either from within code or
 * from the command's definition in package.json
 */
abstract class CommandUsage extends Locatable {
  abstract string getCommandName();
}

/**
 * A usage of a command from the typescript code, by calling `executeCommand`.
 */
class CommandUsageCallExpr extends CommandUsage, CallExpr {
  CommandUsageCallExpr() {
    this.getCalleeName() = "executeCommand" and
    this.getArgument(0).(StringLiteral).getValue().matches("%codeQL%") and
    not this.getFile().getRelativePath().matches("extensions/ql-vscode/test/%")
  }

  override string getCommandName() { result = this.getArgument(0).(StringLiteral).getValue() }
}

/**
 * A usage of a command from the typescript code, by calling `CommandManager.execute`.
 */
class CommandUsageCommandManagerMethodCallExpr extends CommandUsage, MethodCallExpr {
  CommandUsageCommandManagerMethodCallExpr() {
    this.getCalleeName() = "execute" and
    this.getReceiver().getType().unfold().(TypeReference).getTypeName().getName() = "CommandManager" and
    this.getArgument(0).(StringLiteral).getValue().matches("%codeQL%") and
    not this.getFile().getRelativePath().matches("extensions/ql-vscode/test/%")
  }

  override string getCommandName() { result = this.getArgument(0).(StringLiteral).getValue() }
}

/**
 * A usage of a command from any menu that isn't the command palette.
 * This means a user could invoke the command by clicking on a button in
 * something like a menu or a dropdown.
 */
class CommandUsagePackageJsonMenuItem extends CommandUsage, JsonObject {
  CommandUsagePackageJsonMenuItem() {
    exists(this.getPropValue("command")) and
    exists(PackageJson packageJson, string menuName |
      packageJson
          .getPropValue("contributes")
          .getPropValue("menus")
          .getPropValue(menuName)
          .getElementValue(_) = this and
      menuName != "commandPalette"
    )
  }

  override string getCommandName() { result = this.getPropValue("command").getStringValue() }
}

/**
 * Is the given command disabled for use in the command palette by
 * a block with a `"when": "false"` field.
 */
predicate isDisabledInCommandPalette(string commandName) {
  exists(PackageJson packageJson, JsonObject commandPaletteObject |
    packageJson
        .getPropValue("contributes")
        .getPropValue("menus")
        .getPropValue("commandPalette")
        .getElementValue(_) = commandPaletteObject and
    commandPaletteObject.getPropValue("command").getStringValue() = commandName and
    commandPaletteObject.getPropValue("when").getStringValue() = "false"
  )
}

/**
 * Represents a command being usable from the command palette.
 * This means that a user could choose to manually invoke the command.
 */
class CommandUsagePackageJsonCommandPalette extends CommandUsage, JsonObject {
  CommandUsagePackageJsonCommandPalette() {
    this.getFile().getBaseName() = "package.json" and
    exists(this.getPropValue("command")) and
    exists(PackageJson packageJson |
      packageJson.getPropValue("contributes").getPropValue("commands").getElementValue(_) = this
    ) and
    not isDisabledInCommandPalette(this.getPropValue("command").getStringValue())
  }

  override string getCommandName() { result = this.getPropValue("command").getStringValue() }
}

from CommandName c
where c.getNumberOfUsages() > 1 and not c instanceof BuiltInVSCodeCommand
select c.getFirstUsage(),
  "The " + c + " command is used from " + c.getNumberOfUsages() + " locations"
