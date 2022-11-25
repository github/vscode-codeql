import { DownloadLink } from "./download-link";
import { AnalysisFailure } from "./shared/analysis-failure";

export interface RemoteQueryResult {
  executionEndTime: number; // Can't use a Date here since it needs to be serialized and desserialized.
  analysisSummaries: AnalysisSummary[];
  analysisFailures: AnalysisFailure[];
  queryId: string;
}

export interface AnalysisSummary {
  nwo: string;
  databaseSha: string;
  resultCount: number;
  sourceLocationPrefix: string;
  downloadLink: DownloadLink;
  fileSizeInBytes: number;
  starCount?: number;
  lastUpdated?: number;
}

/**
 * Sums up the number of results for all repos queried via a remote query.
 */
export const sumAnalysisSummariesResults = (
  analysisSummaries: AnalysisSummary[],
): number => {
  return analysisSummaries.reduce((acc, cur) => acc + cur.resultCount, 0);
};
