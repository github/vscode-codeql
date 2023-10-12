import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelEditorViewTracker } from "../../../src/model-editor/model-editor-view-tracker";
import { ModelEditorView } from "../../../src/model-editor/model-editor-view";

export function createMockModelEditorViewTracker({
  registerView = jest.fn(),
  unregisterView = jest.fn(),
  getView = jest.fn(),
}: {
  registerView?: ModelEditorViewTracker["registerView"];
  unregisterView?: ModelEditorViewTracker["unregisterView"];
  getView?: ModelEditorViewTracker["getView"];
} = {}): ModelEditorViewTracker<ModelEditorView> {
  return mockedObject<ModelEditorViewTracker<ModelEditorView>>({
    registerView,
    unregisterView,
    getView,
  });
}
