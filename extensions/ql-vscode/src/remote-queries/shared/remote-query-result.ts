export interface RemoteQueryResult {
  queryTitle: string;
  queryFile: string;
  totalRepositoryCount: number;
  affectedRepositoryCount: number;
  totalResultCount: number;
  executionTimestamp: string;
  executionDuration: string;
  downloadLink: string;
  results: AnalysisResult[]
}

export interface AnalysisResult {
  nwo: string,
  resultCount: number,
  downloadLink: string,
  fileSize: string,
}
