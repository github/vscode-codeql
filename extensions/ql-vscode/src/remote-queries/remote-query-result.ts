import { DownloadLink } from './download-link';
import { AnalysisFailure } from './shared/analysis-failure';

export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisSummaries: AnalysisSummary[];
  analysisFailures: AnalysisFailure[];
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
