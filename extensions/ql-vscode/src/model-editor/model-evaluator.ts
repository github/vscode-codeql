import type { ModelingStore } from "./modeling-store";
import type { ModelingEvents } from "./modeling-events";
import type { DatabaseItem } from "../databases/local-databases";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import { DisposableObject } from "../common/disposable-object";
import type { ModelEvaluationRunState } from "./shared/model-evaluation-run-state";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { VariantAnalysisManager } from "../variant-analysis/variant-analysis-manager";
import type { QueryLanguage } from "../common/query-language";
import { resolveCodeScanningQueryPack } from "../variant-analysis/code-scanning-pack";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import type { VariantAnalysis } from "../variant-analysis/shared/variant-analysis";
import type { CancellationToken } from "vscode";
import { CancellationTokenSource } from "vscode";
import type { QlPackDetails } from "../variant-analysis/ql-pack-details";
import type { App } from "../common/app";
import { ModelAlertsView } from "./model-alerts/model-alerts-view";
import type { ExtensionPack } from "./shared/extension-pack";

export class ModelEvaluator extends DisposableObject {
  // Cancellation token source to allow cancelling of the current run
  // before a variant analysis has been submitted. Once it has been
  // submitted, we use the variant analysis manager's cancellation support.
  private cancellationSource: CancellationTokenSource;

  private modelAlertsView: ModelAlertsView | undefined;

  public constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    private readonly variantAnalysisManager: VariantAnalysisManager,
    private readonly dbItem: DatabaseItem,
    private readonly language: QueryLanguage,
    private readonly extensionPack: ExtensionPack,
    private readonly updateModelEditorView: (
      run: ModelEvaluationRunState,
    ) => Promise<void>,
  ) {
    super();

    this.registerToModelingEvents();

    this.cancellationSource = new CancellationTokenSource();
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
      this.app.logger,
      this.cliServer,
      this.language,
      this.cancellationSource.token,
    );

    if (!qlPack) {
      this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
      throw new Error("Unable to trigger evaluation run");
    }

    // Submit variant analysis and monitor progress
    return withProgress(
      (progress) =>
        this.runVariantAnalysis(
          qlPack,
          progress,
          this.cancellationSource.token,
        ),
      {
        title: "Run model evaluation",
        cancellable: false,
      },
    );
  }

  public async stopEvaluation() {
    const evaluationRun = this.modelingStore.getModelEvaluationRun(this.dbItem);
    if (!evaluationRun) {
      void this.app.logger.log("No active evaluation run to stop");
      return;
    }

    this.cancellationSource.cancel();

    if (evaluationRun.variantAnalysisId === undefined) {
      // If the variant analysis has not been submitted yet, we can just
      // update the store.
      this.modelingStore.updateModelEvaluationRun(this.dbItem, {
        ...evaluationRun,
        isPreparing: false,
      });
    } else {
      // If the variant analysis has been submitted, we need to cancel it. We
      // don't need to update the store here, as the event handler for
      // onVariantAnalysisStatusUpdated will do that for us.
      await this.variantAnalysisManager.cancelVariantAnalysis(
        evaluationRun.variantAnalysisId,
      );
    }
  }

  public async openModelAlertsView() {
    if (this.modelingStore.isModelAlertsViewOpen(this.dbItem)) {
      this.modelingEvents.fireFocusModelAlertsViewEvent(
        this.dbItem.databaseUri.toString(),
      );
      return;
    } else {
      this.modelingStore.updateIsModelAlertsViewOpen(this.dbItem, true);
      this.modelAlertsView = new ModelAlertsView(
        this.app,
        this.modelingEvents,
        this.modelingStore,
        this.dbItem,
        this.extensionPack,
      );
      await this.modelAlertsView.showView();

      // There should be a variant analysis available at this point, as the
      // view can only opened when the variant analysis is submitted.
      const evaluationRun = this.modelingStore.getModelEvaluationRun(
        this.dbItem,
      );
      if (!evaluationRun) {
        throw new Error("No evaluation run available");
      }

      const variantAnalysis =
        await this.getVariantAnalysisForRun(evaluationRun);

      if (!variantAnalysis) {
        throw new Error("No variant analysis available");
      }

      await this.modelAlertsView.updateVariantAnalysis(variantAnalysis);
    }
  }

  private registerToModelingEvents() {
    this.push(
      this.modelingEvents.onModelEvaluationRunChanged(async (event) => {
        if (event.dbUri === this.dbItem.databaseUri.toString()) {
          if (!event.evaluationRun) {
            await this.updateModelEditorView({
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
            await this.updateModelEditorView(run);
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

  private async runVariantAnalysis(
    qlPack: QlPackDetails,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<number | void> {
    let result: number | void = undefined;
    try {
      // Use Promise.race to make sure to stop the variant analysis processing when the
      // user has stopped the evaluation run. We can't simply rely on the cancellation token
      // because we haven't fully implemented cancellation support for variant analysis.
      // Using this approach we make sure that the process is stopped from a user's point
      // of view (the notification goes away too). It won't necessarily stop any tasks
      // that are not aware of the cancellation token.
      result = await Promise.race([
        this.variantAnalysisManager.runVariantAnalysis(
          qlPack,
          progress,
          token,
          false,
        ),
        new Promise<void>((_, reject) => {
          token.onCancellationRequested(() =>
            reject(new UserCancellationException(undefined, true)),
          );
        }),
      ]);
    } catch (e) {
      this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
      if (!(e instanceof UserCancellationException)) {
        throw e;
      } else {
        return;
      }
    } finally {
      // Renew the cancellation token source for the new evaluation run.
      // This is necessary because we don't want the next evaluation run
      // to start as cancelled.
      this.cancellationSource = new CancellationTokenSource();
    }

    // If the result is a number, it means the variant analysis was successfully submitted,
    // so we need to update the store and start up the monitor.
    if (typeof result === "number") {
      this.modelingStore.updateModelEvaluationRun(this.dbItem, {
        isPreparing: true,
        variantAnalysisId: result,
      });
      this.monitorVariantAnalysis(result);
    } else {
      this.modelingStore.updateModelEvaluationRun(this.dbItem, undefined);
      throw new Error("Unable to trigger variant analysis for evaluation run");
    }
  }

  private monitorVariantAnalysis(variantAnalysisId: number) {
    this.push(
      this.variantAnalysisManager.onVariantAnalysisStatusUpdated(
        async (variantAnalysis) => {
          // Make sure it's the variant analysis we're interested in
          if (variantAnalysis.id === variantAnalysisId) {
            // Update model editor view
            await this.updateModelEditorView({
              isPreparing: false,
              variantAnalysis,
            });

            // Update model alerts view
            await this.modelAlertsView?.updateVariantAnalysis(variantAnalysis);
          }
        },
      ),
    );

    this.push(
      this.variantAnalysisManager.onRepoStatesUpdated(async (e) => {
        if (e.variantAnalysisId === variantAnalysisId) {
          await this.modelAlertsView?.updateRepoState(e.repoState);
        }
      }),
    );

    this.push(
      this.variantAnalysisManager.onRepoResultsLoaded(async (e) => {
        if (e.variantAnalysisId === variantAnalysisId) {
          await this.modelAlertsView?.updateRepoResults(e);
        }
      }),
    );
  }
}
