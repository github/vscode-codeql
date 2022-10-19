import { assertNever } from './pure/helpers-pure';
import { VariantAnalysisStatus } from './remote-queries/shared/variant-analysis';

export enum QueryStatus {
  InProgress = 'InProgress',
  Completed = 'Completed',
  Failed = 'Failed',
}

export function variantAnalysisStatusToQueryStatus(status: VariantAnalysisStatus): QueryStatus {
  switch (status) {
    case VariantAnalysisStatus.Succeeded:
      return QueryStatus.Completed;
    case VariantAnalysisStatus.Failed:
      return QueryStatus.Failed;
    case VariantAnalysisStatus.InProgress:
      return QueryStatus.InProgress;
    case VariantAnalysisStatus.Canceled:
      return QueryStatus.Completed;
    default:
      assertNever(status);
  }
}
