export interface ModelEvaluationRun {
  status: ModelEvaluationStatus;
  variantAnalysisId: number | undefined;
}

type ModelEvaluationStatus =
  | "preparing"
  | "inProgress"
  | "succeeded"
  | "failed"
  | "canceled";

export function evaluationRunIsRunning(
  evaluationRun: ModelEvaluationRun,
): boolean {
  return (
    evaluationRun.status === "preparing" ||
    evaluationRun.status === "inProgress"
  );
}
