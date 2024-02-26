import type { ExtensionPack } from "./extension-pack";
import type { Mode } from "./mode";
import type { QueryLanguage } from "../../common/query-language";
import type { ModelConfig } from "../languages";

export interface ModelEditorViewState {
  extensionPack: ExtensionPack;
  language: QueryLanguage;
  showGenerateButton: boolean;
  showLlmButton: boolean;
  showEvaluationUi: boolean;
  mode: Mode;
  showModeSwitchButton: boolean;
  sourceArchiveAvailable: boolean;
  modelConfig: ModelConfig;
}

export interface MethodModelingPanelViewState {
  language: QueryLanguage | undefined;
  modelConfig: ModelConfig;
}
