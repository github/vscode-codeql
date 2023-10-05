import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn(),
  onActiveDbChanged = jest.fn(),
  onDbClosed = jest.fn(),
  onMethodsChanged = jest.fn(),
  onHideModeledMethodsChanged = jest.fn(),
  onModeledMethodsChanged = jest.fn(),
  onModifiedMethodsChanged = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
  onActiveDbChanged?: ModelingStore["onActiveDbChanged"];
  onDbClosed?: ModelingStore["onDbClosed"];
  onMethodsChanged?: ModelingStore["onMethodsChanged"];
  onHideModeledMethodsChanged?: ModelingStore["onHideModeledMethodsChanged"];
  onModeledMethodsChanged?: ModelingStore["onModeledMethodsChanged"];
  onModifiedMethodsChanged?: ModelingStore["onModifiedMethodsChanged"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getStateForActiveDb,
    onActiveDbChanged,
    onDbClosed,
    onMethodsChanged,
    onHideModeledMethodsChanged,
    onModeledMethodsChanged,
    onModifiedMethodsChanged,
  });
}
