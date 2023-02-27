/**
 * @name A VS Code command should not be used in multiple locations
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/unique-command-use
 * @description Using each VS Code command from only one location makes
 * our telemtry more useful because we can differentiate more user
 * interactions and know which features of the UI users are using.
 */

 import javascript

 abstract class CommandUsage extends Locatable {
   abstract string getCommandName();
 
   predicate isUsedFromOtherPlace() {
     exists(CommandUsage e | e != this and e.getCommandName() = this.getCommandName())
   }
 
   predicate isFirstUsage() {
     forall(CommandUsage e | e.getCommandName() = this.getCommandName() |
       e.getLocationOrdinal() >= this.getLocationOrdinal()
     )
   }
 
   string getLocationOrdinal() {
     result =
       this.getFile().getRelativePath() + ":" + this.getLocation().getStartLine() + ":" +
         this.getLocation().getStartColumn()
   }
 }
 
 class CommandUsageCallExpr extends CommandUsage, CallExpr {
   CommandUsageCallExpr() {
     this.getCalleeName() = "executeCommand" and
     this.getArgument(0).(StringLiteral).getValue().matches("%codeQL%") and
     not this.getFile().getRelativePath().matches("extensions/ql-vscode/test/%")
   }
 
   override string getCommandName() { result = this.getArgument(0).(StringLiteral).getValue() }
 }
 
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
 
 from CommandUsage e
 where
   e.isUsedFromOtherPlace() and
   not e.isFirstUsage()
 select e, "The " + e.getCommandName() + " command is used from another location"
 