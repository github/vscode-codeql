export interface RemoteQueryResultIndex {
  artifactsUrlPath: string;
  items: RemoteQueryResultIndexItem[];
}

export interface RemoteQuerySuccessIndexItem {
  id: string;
  artifactId: number;
  nwo: string;
  resultCount: number;
  bqrsFileSize: number;
  sarifFileSize?: number;
}

export interface RemoteQueryFailureIndexItem {
  id: string;
  artifactId: number;
  nwo: string;
  error: string;
}

export type RemoteQueryResultIndexItem = RemoteQuerySuccessIndexItem & RemoteQueryFailureIndexItem;
