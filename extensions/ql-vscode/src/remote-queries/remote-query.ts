import { Repository } from './repository';

export interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  queryText: string;
  language: string;
  controllerRepository: Repository;
  executionStartTime: number; // Use number here since it needs to be serialized and desserialized.
  actionsWorkflowRunId: number;
  repositoryCount: number;
}
