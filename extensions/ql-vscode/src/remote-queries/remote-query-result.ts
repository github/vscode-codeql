import { DownloadLink } from './download-link';

export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisSummary: AnalysisSummary[];
  allResultsDownloadLink: DownloadLink;
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
