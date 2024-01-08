import type { ExtensionPack } from "./extension-pack";
import type { Mode } from "./mode";
import type { QueryLanguage } from "../../common/query-language";

export interface ModelEditorViewState {
  extensionPack: ExtensionPack;
  language: QueryLanguage;
  showGenerateButton: boolean;
  showLlmButton: boolean;
  mode: Mode;
  showModeSwitchButton: boolean;
  sourceArchiveAvailable: boolean;
}

export interface MethodModelingPanelViewState {
  language: QueryLanguage | undefined;
}
