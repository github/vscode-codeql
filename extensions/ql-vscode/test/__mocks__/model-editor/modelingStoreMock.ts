import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn(),
  onActiveDbChanged = jest.fn(),
  onDbClosed = jest.fn(),
  onMethodsChanged = jest.fn(),
  onHideModeledMethodsChanged = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
  onActiveDbChanged?: ModelingStore["onActiveDbChanged"];
  onDbClosed?: ModelingStore["onDbClosed"];
  onMethodsChanged?: ModelingStore["onMethodsChanged"];
  onHideModeledMethodsChanged?: ModelingStore["onHideModeledMethodsChanged"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getStateForActiveDb,
    onActiveDbChanged,
    onDbClosed,
    onMethodsChanged,
    onHideModeledMethodsChanged,
  });
}
