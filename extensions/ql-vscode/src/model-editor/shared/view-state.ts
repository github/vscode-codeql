import { ExtensionPack } from "./extension-pack";
import { Mode } from "./mode";
import { QueryLanguage } from "../../common/query-language";

export interface ModelEditorViewState {
  extensionPack: ExtensionPack;
  language: QueryLanguage;
  showFlowGeneration: boolean;
  showLlmButton: boolean;
  showMultipleModels: boolean;
  mode: Mode;
  showModeSwitchButton: boolean;
  sourceArchiveAvailable: boolean;
}

export interface MethodModelingPanelViewState {
  language: QueryLanguage | undefined;
  showMultipleModels: boolean;
}
