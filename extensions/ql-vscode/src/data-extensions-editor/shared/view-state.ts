import { ExtensionPack } from "./extension-pack";
import { Mode } from "./mode";

export interface DataExtensionEditorViewState {
  extensionPack: ExtensionPack;
  enableFrameworkMode: boolean;
  showLlmButton: boolean;
  mode: Mode;
}
