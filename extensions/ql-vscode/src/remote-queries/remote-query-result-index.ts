export interface RemoteQueryResultIndex {
  artifactsUrlPath: string;
  allResultsArtifactId: number;
  items: RemoteQueryResultIndexItem[];
}

export interface RemoteQueryResultIndexItem {
  id: string;
  artifactId: number;
  nwo: string;
  resultCount: number;
  bqrsFileSize: number;
  sarifFileSize?: number;
}
