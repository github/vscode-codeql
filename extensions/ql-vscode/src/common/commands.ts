import { CommandManager } from "../packages/commands";

export type ExtensionCommands = {
  "codeQL.openDocumentation": () => Promise<void>;
};

export type VariantAnalysisCommands = {
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
};

export type AllCommands = ExtensionCommands & VariantAnalysisCommands;

export type ExtensionCommandManager = CommandManager<AllCommands>;
