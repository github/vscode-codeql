import type { ModelingStore } from "./modeling-store";
import type { ModelingEvents } from "./modeling-events";
import type { DatabaseItem } from "../databases/local-databases";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import { DisposableObject } from "../common/disposable-object";
import { sleep } from "../common/time";
import type { ModelEvaluationRunState } from "./shared/model-evaluation-run-state";

export class ModelEvaluator extends DisposableObject {
  public constructor(
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    private readonly dbItem: DatabaseItem,
    private readonly updateView: (
      run: ModelEvaluationRunState,
    ) => Promise<void>,
  ) {
    super();

    this.registerToModelingEvents();
  }

  public async startEvaluation() {
    // Update store with evaluation run status
    const evaluationRun: ModelEvaluationRun = {
      isPreparing: true,
      variantAnalysisId: undefined,
    };
    this.modelingStore.updateModelEvaluationRun(this.dbItem, evaluationRun);

    // For now, just wait 5 seconds and then update the store with the succeeded status.
    // In the future, this will be replaced with the actual evaluation process.
    void sleep(5000).then(() => {
      const completedEvaluationRun: ModelEvaluationRun = {
        isPreparing: false,
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
      isPreparing: false,
      variantAnalysisId: undefined,
    };
    this.modelingStore.updateModelEvaluationRun(this.dbItem, evaluationRun);
  }

  private registerToModelingEvents() {
    this.push(
      this.modelingEvents.onModelEvaluationRunChanged(async (event) => {
        if (
          event.evaluationRun &&
          event.dbUri === this.dbItem.databaseUri.toString()
        ) {
          const run: ModelEvaluationRunState = {
            isPreparing: event.evaluationRun.isPreparing,

            // TODO: Get variant analysis from id.
            variantAnalysis: undefined,
          };
          await this.updateView(run);
        }
      }),
    );
  }
}
