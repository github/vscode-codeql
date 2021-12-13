import { DownloadLink } from './download-link';

export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisResults: AnalysisResult[];
  allResultsDownloadLink: DownloadLink;
}

export interface AnalysisResult {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
