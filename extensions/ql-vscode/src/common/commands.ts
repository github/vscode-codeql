import { CommandManager } from "../packages/commands";

/**
 * Contains type definitions for all commands used by the extension.
 *
 * To add a new command first define its type here, then provide
 * the implementation in the corresponding `getCommands` function.
 */

// Base commands not tied directly to a module like e.g. variant analysis.
export type BaseCommands = {
  "codeQL.openDocumentation": () => Promise<void>;
};

// Commands tied to variant analysis
export type VariantAnalysisCommands = {
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
};

export type AllCommands = BaseCommands & VariantAnalysisCommands;

export type AppCommandManager = CommandManager<AllCommands>;
