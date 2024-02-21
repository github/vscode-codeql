import type { ModelingStore } from "./modeling-store";
import type { DatabaseItem } from "../databases/local-databases";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import { DisposableObject } from "../common/disposable-object";
import { sleep } from "../common/time";

export class ModelEvaluator extends DisposableObject {
  public constructor(
    private readonly modelingStore: ModelingStore,
    private readonly dbItem: DatabaseItem,
  ) {
    super();
  }

  public async startEvaluation() {
    // Update store with evaluation run status
    const evaluationRun: ModelEvaluationRun = {
      status: "preparing",
      variantAnalysisId: undefined,
    };
    this.modelingStore.updateModelEvaluationRun(this.dbItem, evaluationRun);

    // For now, just wait 5 seconds and then update the store with the succeeded status.
    // In the future, this will be replaced with the actual evaluation process.
    void sleep(5000).then(() => {
      const completedEvaluationRun: ModelEvaluationRun = {
        status: "succeeded",
        variantAnalysisId: undefined,
      };
      this.modelingStore.updateModelEvaluationRun(
        this.dbItem,
        completedEvaluationRun,
      );
    });
  }

  public async stopEvaluation() {
    // For now just update the store with the canceled status.
    // This will be fleshed out in the near future.
    const evaluationRun: ModelEvaluationRun = {
      status: "canceled",
      variantAnalysisId: undefined,
    };
    this.modelingStore.updateModelEvaluationRun(this.dbItem, evaluationRun);
  }
}
