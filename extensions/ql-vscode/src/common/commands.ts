import { CommandManager } from "../packages/commands";

/**
 * Contains type definitions for all commands used by the extension.
 *
 * To add a new command first define its type here, then provide
 * the implementation in the corresponding `getCommands` function.
 */

// Commands directly in the extension
export type ExtensionCommands = {
  "codeQL.openDocumentation": () => Promise<void>;
};

// Commands tied to variant analysis
export type VariantAnalysisCommands = {
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
};

export type AllCommands = ExtensionCommands & VariantAnalysisCommands;

export type ExtensionCommandManager = CommandManager<AllCommands>;
