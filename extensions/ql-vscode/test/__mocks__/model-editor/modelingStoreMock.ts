import { mockedObject } from "../../vscode-tests/utils/mocking.helpers";
import type { ModelingStore } from "../../../src/model-editor/modeling-store";

export function createMockModelingStore({
  initializeStateForDb = jest.fn(),
  getStateForActiveDb = jest.fn().mockReturnValue(undefined),
  getSelectedMethodDetails = jest.fn().mockReturnValue(undefined),
  getModelEvaluationRun = jest.fn(),
  updateModelEvaluationRun = jest.fn(),
}: {
  initializeStateForDb?: ModelingStore["initializeStateForDb"];
  getStateForActiveDb?: ModelingStore["getStateForActiveDb"];
  getSelectedMethodDetails?: ModelingStore["getSelectedMethodDetails"];
  getModelEvaluationRun?: ModelingStore["getModelEvaluationRun"];
  updateModelEvaluationRun?: ModelingStore["updateModelEvaluationRun"];
} = {}): ModelingStore {
  return mockedObject<ModelingStore>({
    initializeStateForDb,
    getSelectedMethodDetails,
    getStateForActiveDb,
    getModelEvaluationRun,
    updateModelEvaluationRun,
  });
}
