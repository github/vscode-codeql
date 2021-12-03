import { Repository } from './repository';

export interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  controllerRepository: Repository;
  repositories: Repository[];
  executionStartTime: Date;
  actionsWorkflowRunId: number;
}
