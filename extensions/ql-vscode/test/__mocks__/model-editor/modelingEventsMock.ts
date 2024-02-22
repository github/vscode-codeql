import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import type { ModelingEvents } from "../../../src/model-editor/modeling-events";

export function createMockModelingEvents({
  onActiveDbChanged = jest.fn(),
  onDbClosed = jest.fn(),
  onModelingStateChanged = jest.fn(),
  onHideModeledMethodsChanged = jest.fn(),
  onModeChanged = jest.fn(),
  onRevealInModelEditor = jest.fn(),
  onFocusModelEditor = jest.fn(),
}: {
  onActiveDbChanged?: ModelingEvents["onActiveDbChanged"];
  onDbClosed?: ModelingEvents["onDbClosed"];
  onModelingStateChanged?: ModelingEvents["onModelingStateChanged"];
  onHideModeledMethodsChanged?: ModelingEvents["onHideModeledMethodsChanged"];
  onModeChanged?: ModelingEvents["onModeChanged"];
  onRevealInModelEditor?: ModelingEvents["onRevealInModelEditor"];
  onFocusModelEditor?: ModelingEvents["onFocusModelEditor"];
} = {}): ModelingEvents {
  return mockedObject<ModelingEvents>({
    onActiveDbChanged,
    onDbClosed,
    onModelingStateChanged,
    onHideModeledMethodsChanged,
    onModeChanged,
    onRevealInModelEditor,
    onFocusModelEditor,
  });
}
