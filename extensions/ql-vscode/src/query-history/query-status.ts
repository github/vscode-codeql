import { assertNever } from "../common/helpers-pure";
import { VariantAnalysisStatus } from "../variant-analysis/shared/variant-analysis";

export enum QueryStatus {
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
}

export function variantAnalysisStatusToQueryStatus(
  status: VariantAnalysisStatus,
): QueryStatus {
  switch (status) {
    case VariantAnalysisStatus.Succeeded:
      return QueryStatus.Completed;
    case VariantAnalysisStatus.Failed:
      return QueryStatus.Failed;
    case VariantAnalysisStatus.InProgress:
      return QueryStatus.InProgress;
    case VariantAnalysisStatus.Canceling:
      return QueryStatus.InProgress;
    case VariantAnalysisStatus.Canceled:
      return QueryStatus.Completed;
    default:
      assertNever(status);
  }
}

export function humanizeQueryStatus(status: QueryStatus): string {
  switch (status) {
    case QueryStatus.InProgress:
      return "in progress";
    case QueryStatus.Completed:
      return "completed";
    case QueryStatus.Failed:
      return "failed";
    default:
      return "unknown";
  }
}
