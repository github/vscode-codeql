import { DownloadLink } from "../download-link";
import { AnalysisFailure } from "./analysis-failure";

export interface RemoteQueryResult {
  queryId: string;
  queryTitle: string;
  queryFileName: string;
  queryFilePath: string;
  queryText: string;
  language: string;
  workflowRunUrl: string;
  totalRepositoryCount: number;
  affectedRepositoryCount: number;
  totalResultCount: number;
  executionTimestamp: string;
  executionDuration: string;
  analysisSummaries: AnalysisSummary[];
  analysisFailures: AnalysisFailure[];
}

export interface AnalysisSummary {
  nwo: string;
  databaseSha: string;
  resultCount: number;
  sourceLocationPrefix: string;
  downloadLink: DownloadLink;
  fileSize: string;
  starCount?: number;
  lastUpdated?: number;
}
