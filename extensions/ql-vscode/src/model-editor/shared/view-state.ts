import { ExtensionPack } from "./extension-pack";
import { Mode } from "./mode";

export interface DataExtensionEditorViewState {
  extensionPack: ExtensionPack;
  showLlmButton: boolean;
  mode: Mode;
}
