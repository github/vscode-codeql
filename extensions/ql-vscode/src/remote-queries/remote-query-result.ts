export interface RemoteQueryResult {
  executionEndTime: Date;
  analysisResults: AnalysisResult[];
  allResultsDownloadUri: string;
}

export interface AnalysisResult {
  nwo: string,
  resultCount: number,
  downloadUri: string,
  fileSizeInBytes: number
}
