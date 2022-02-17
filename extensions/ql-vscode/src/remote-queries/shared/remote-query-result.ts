import { DownloadLink } from '../download-link';
import { AnalysisFailure } from './analysis-failure';

export interface RemoteQueryResult {
  queryTitle: string;
  queryFileName: string;
  queryFilePath: string;
  queryText: string;
  totalRepositoryCount: number;
  affectedRepositoryCount: number;
  totalResultCount: number;
  executionTimestamp: string;
  executionDuration: string;
  analysisSummaries: AnalysisSummary[],
  analysisFailures: AnalysisFailure[];
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSize: string,
}
