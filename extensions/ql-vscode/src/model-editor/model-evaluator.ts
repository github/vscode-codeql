import type { ModelingStore } from "./modeling-store";
import type { ModelingEvents } from "./modeling-events";
import type { DatabaseItem } from "../databases/local-databases";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import { DisposableObject } from "../common/disposable-object";
import type { ModelEvaluationRunState } from "./shared/model-evaluation-run-state";
import type { BaseLogger } from "../common/logging";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { VariantAnalysisManager } from "../variant-analysis/variant-analysis-manager";
import type { QueryLanguage } from "../common/query-language";
import { resolveCodeScanningQueryPack } from "../variant-analysis/code-scanning-pack";
import { withProgress } from "../common/vscode/progress";
import type { VariantAnalysis } from "../variant-analysis/shared/variant-analysis";

export class ModelEvaluator extends DisposableObject {
  public constructor(
    private readonly logger: BaseLogger,
    private readonly cliServer: CodeQLCliServer,
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    private readonly variantAnalysisManager: VariantAnalysisManager,
    private readonly dbItem: DatabaseItem,
    private readonly language: QueryLanguage,
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

    // Build pack
    const qlPack = await resolveCodeScanningQueryPack(
      this.logger,
      this.cliServer,
      this.language,
    );

    if (!qlPack) {
      this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
      throw new Error("Unable to trigger evaluation run");
    }

    // Submit variant analysis and monitor progress
    return withProgress(
      async (progress, token) => {
        let variantAnalysisId: number | undefined = undefined;
        try {
          variantAnalysisId =
            await this.variantAnalysisManager.runVariantAnalysis(
              qlPack,
              progress,
              token,
              false,
            );
        } catch (e) {
          this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
          throw e;
        }

        if (variantAnalysisId) {
          this.monitorVariantAnalysis(variantAnalysisId);
        } else {
          this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
          throw new Error(
            "Unable to trigger variant analysis for evaluation run",
          );
        }
      },
      {
        title: "Run model evaluation",
        cancellable: false,
      },
    );
  }

  public async stopEvaluation() {
    // For now just update the store.
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
        if (event.dbUri === this.dbItem.databaseUri.toString()) {
          if (!event.evaluationRun) {
            await this.updateView({
              isPreparing: false,
              variantAnalysis: undefined,
            });
          } else {
            const variantAnalysis = await this.getVariantAnalysisForRun(
              event.evaluationRun,
            );
            const run: ModelEvaluationRunState = {
              isPreparing: event.evaluationRun.isPreparing,
              variantAnalysis,
            };
            await this.updateView(run);
          }
        }
      }),
    );
  }

  private async getVariantAnalysisForRun(
    evaluationRun: ModelEvaluationRun,
  ): Promise<VariantAnalysis | undefined> {
    if (evaluationRun.variantAnalysisId) {
      return this.variantAnalysisManager.tryGetVariantAnalysis(
        evaluationRun.variantAnalysisId,
      );
    }
    return undefined;
  }

  private monitorVariantAnalysis(variantAnalysisId: number) {
    this.push(
      this.variantAnalysisManager.onVariantAnalysisStatusUpdated(
        async (variantAnalysis) => {
          // Make sure it's the variant analysis we're interested in
          if (variantAnalysisId === variantAnalysis.id) {
            await this.updateView({
              isPreparing: false,
              variantAnalysis,
            });
          }
        },
      ),
    );
  }
}
