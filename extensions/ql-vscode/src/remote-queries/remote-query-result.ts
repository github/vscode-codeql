import { DownloadLink } from './download-link';

export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisSummaries: AnalysisSummary[];
}

export interface AnalysisSummary {
  nwo: string,
  resultCount: number,
  downloadLink: DownloadLink,
  fileSizeInBytes: number
}
