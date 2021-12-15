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
  results: AnalysisResult[]
}

export interface AnalysisResult {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSize: string,
}
