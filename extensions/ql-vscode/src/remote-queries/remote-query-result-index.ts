export interface RemoteQueryResultIndex {
  artifactsUrlPath: string;
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
