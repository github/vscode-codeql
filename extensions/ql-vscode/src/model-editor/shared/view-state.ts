import { ExtensionPack } from "./extension-pack";
import { Mode } from "./mode";

export interface ModelEditorViewState {
  extensionPack: ExtensionPack;
  showLlmButton: boolean;
  mode: Mode;
}
