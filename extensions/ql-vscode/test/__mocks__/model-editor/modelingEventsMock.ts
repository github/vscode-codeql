import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelingEvents } from "../../../src/model-editor/modeling-events";

export function createMockModelingEvents({
  onActiveDbChanged = jest.fn(),
  onDbClosed = jest.fn(),
  onMethodsChanged = jest.fn(),
  onHideModeledMethodsChanged = jest.fn(),
  onModeChanged = jest.fn(),
  onModeledMethodsChanged = jest.fn(),
  onModifiedMethodsChanged = jest.fn(),
  onInProgressMethodsChanged = jest.fn(),
  onRevealInModelEditor = jest.fn(),
  onFocusModelEditor = jest.fn(),
}: {
  onActiveDbChanged?: ModelingEvents["onActiveDbChanged"];
  onDbClosed?: ModelingEvents["onDbClosed"];
  onMethodsChanged?: ModelingEvents["onMethodsChanged"];
  onHideModeledMethodsChanged?: ModelingEvents["onHideModeledMethodsChanged"];
  onModeChanged?: ModelingEvents["onModeChanged"];
  onModeledMethodsChanged?: ModelingEvents["onModeledMethodsChanged"];
  onModifiedMethodsChanged?: ModelingEvents["onModifiedMethodsChanged"];
  onInProgressMethodsChanged?: ModelingEvents["onInProgressMethodsChanged"];
  onRevealInModelEditor?: ModelingEvents["onRevealInModelEditor"];
  onFocusModelEditor?: ModelingEvents["onFocusModelEditor"];
} = {}): ModelingEvents {
  return mockedObject<ModelingEvents>({
    onActiveDbChanged,
    onDbClosed,
    onMethodsChanged,
    onHideModeledMethodsChanged,
    onModeChanged,
    onModeledMethodsChanged,
    onModifiedMethodsChanged,
    onInProgressMethodsChanged,
    onRevealInModelEditor,
    onFocusModelEditor,
  });
}
