import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn(),
  onActiveDbChanged = jest.fn(),
  onDbClosed = jest.fn(),
  onMethodsChanged = jest.fn(),
  onHideModeledMethodsChanged = jest.fn(),
  onModeChanged = jest.fn(),
  onModeledMethodsChanged = jest.fn(),
  onModifiedMethodsChanged = jest.fn(),
  onInProgressMethodsChanged = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
  onActiveDbChanged?: ModelingStore["onActiveDbChanged"];
  onDbClosed?: ModelingStore["onDbClosed"];
  onMethodsChanged?: ModelingStore["onMethodsChanged"];
  onHideModeledMethodsChanged?: ModelingStore["onHideModeledMethodsChanged"];
  onModeChanged?: ModelingStore["onModeChanged"];
  onModeledMethodsChanged?: ModelingStore["onModeledMethodsChanged"];
  onModifiedMethodsChanged?: ModelingStore["onModifiedMethodsChanged"];
  onInProgressMethodsChanged?: ModelingStore["onInProgressMethodsChanged"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getStateForActiveDb,
    onActiveDbChanged,
    onDbClosed,
    onMethodsChanged,
    onHideModeledMethodsChanged,
    onModeChanged,
    onModeledMethodsChanged,
    onModifiedMethodsChanged,
    onInProgressMethodsChanged,
  });
}
