import { Repository as RemoteRepository } from "./repository";

export interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  queryText: string;
  language: string;
  controllerRepository: RemoteRepository;
  executionStartTime: number; // Use number here since it needs to be serialized and desserialized.
  actionsWorkflowRunId: number;
  repositoryCount: number;
}
