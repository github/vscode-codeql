export interface RemoteQueryHistoryItem {
  readonly t: "remote";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  readonly queryId: string;
  remoteQuery: RemoteQuery;
  userSpecifiedLabel?: string;
}

export enum QueryStatus {
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
}

interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  queryText: string;
  language: string;
  controllerRepository: RemoteRepository;
  executionStartTime: number; // Use number here since it needs to be serialized and desserialized.
  actionsWorkflowRunId: number;
  repositoryCount: number;
}

interface RemoteRepository {
  owner: string;
  name: string;
}
