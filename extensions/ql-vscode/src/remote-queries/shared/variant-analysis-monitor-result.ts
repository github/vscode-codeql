export type VariantAnalysisMonitorStatus =
  | 'InProgress'
  | 'CompletedSuccessfully'
  | 'CompletedUnsuccessfully'
  | 'Failed'
  | 'Cancelled'
  | 'TimedOut';

export interface VariantAnalysisMonitorResult {
  status: VariantAnalysisMonitorStatus;
  error?: string;
  scannedReposDownloaded?: number[]
}