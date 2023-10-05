import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelEditorViewTracker } from "../../../src/model-editor/model-editor-view-tracker";
import { ModelEditorView } from "../../../src/model-editor/model-editor-view";

export function createMockModelEditorViewTracker({
  registerView = jest.fn(),
  unregisterView = jest.fn(),
  getViews = jest.fn(),
}: {
  registerView?: ModelEditorViewTracker["registerView"];
  unregisterView?: ModelEditorViewTracker["unregisterView"];
  getViews?: ModelEditorViewTracker["getViews"];
} = {}): ModelEditorViewTracker<ModelEditorView> {
  return mockedObject<ModelEditorViewTracker<ModelEditorView>>({
    registerView,
    unregisterView,
    getViews,
  });
}
