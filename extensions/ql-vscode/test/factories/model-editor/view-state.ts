import type { ModelEditorViewState } from "../../../src/model-editor/shared/view-state";
import { Mode } from "../../../src/model-editor/shared/mode";
import { createMockExtensionPack } from "./extension-pack";
import { QueryLanguage } from "../../../src/common/query-language";
import { defaultModelConfig } from "../../../src/model-editor/languages";

export function createMockModelEditorViewState(
  data: Partial<ModelEditorViewState> = {},
): ModelEditorViewState {
  return {
    language: QueryLanguage.Java,
    mode: Mode.Application,
    showGenerateButton: false,
    showEvaluationUi: false,
    showModeSwitchButton: true,
    extensionPack: createMockExtensionPack(),
    sourceArchiveAvailable: true,
    modelConfig: defaultModelConfig,
    ...data,
  };
}
