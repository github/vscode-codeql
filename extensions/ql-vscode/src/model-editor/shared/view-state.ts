import { ExtensionPack } from "./extension-pack";
import { Mode } from "./mode";

export interface ModelEditorViewState {
  extensionPack: ExtensionPack;
  showFlowGeneration: boolean;
  showLlmButton: boolean;
  showMultipleModels: boolean;
  mode: Mode;
}
