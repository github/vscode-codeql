import { ExtensionPackModelFile } from "./extension-pack";

export interface DataExtensionEditorViewState {
  extensionPackModelFile: ExtensionPackModelFile;
  modelFileExists: boolean;
  showLlmButton: boolean;
}
