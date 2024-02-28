import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import type { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn(),
  getModelEvaluationRun = jest.fn(),
  updateModelEvaluationRun = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
  getModelEvaluationRun?: ModelingStore["getModelEvaluationRun"];
  updateModelEvaluationRun?: ModelingStore["updateModelEvaluationRun"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getStateForActiveDb,
    getModelEvaluationRun,
    updateModelEvaluationRun,
  });
}
