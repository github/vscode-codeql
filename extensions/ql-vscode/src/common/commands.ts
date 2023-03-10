import { CommandManager } from "../packages/commands";

export type ExtensionCommands = {
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
};

export type AllCommands = ExtensionCommands;

export type ExtensionCommandManager = CommandManager<AllCommands>;
