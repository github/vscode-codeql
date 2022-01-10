import { DownloadLink } from '../download-link';

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
  downloadLink: DownloadLink;
  analysisSummaries: AnalysisSummary[]
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSize: string,
}
