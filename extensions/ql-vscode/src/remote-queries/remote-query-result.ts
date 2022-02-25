import { DownloadLink } from './download-link';
import { AnalysisFailure } from './shared/analysis-failure';

export interface RemoteQueryResult {
  executionEndTime: number; // Can't use a Date here since it needs to be serialized and desserialized.
  analysisSummaries: AnalysisSummary[];
  analysisFailures: AnalysisFailure[];
  queryId: string;
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
