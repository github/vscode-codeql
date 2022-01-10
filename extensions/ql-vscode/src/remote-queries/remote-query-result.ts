import { DownloadLink } from './download-link';

export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisSummaries: AnalysisSummary[];
  allResultsDownloadLink: DownloadLink;
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
