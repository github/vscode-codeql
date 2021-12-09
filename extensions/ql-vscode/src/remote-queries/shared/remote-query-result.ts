export interface RemoteQueryResult {
  queryTitle: string;
  queryFileName: string;
  queryFilePath: string;
  queryTextTmpFilePath: string;
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
