import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";

export interface ModelEvaluationRunState {
  isPreparing: boolean;
  variantAnalysis: VariantAnalysis | undefined;
}

export function modelEvaluationRunIsRunning(
  run: ModelEvaluationRunState,
): boolean {
  return (
    run.isPreparing ||
    !!(
      run.variantAnalysis &&
      run.variantAnalysis.status === VariantAnalysisStatus.InProgress
    )
  );
}
