import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getStateForActiveDb,
  });
}
