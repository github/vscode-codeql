import { Repository } from './repository';

export interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  queryText: string;
  controllerRepository: Repository;
  repositories: Repository[];
  executionStartTime: number; // Use number here since it needs to be serialized and desserialized.
  actionsWorkflowRunId: number;
}
