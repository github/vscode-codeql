export interface RemoteQueriesSubmission {
  ref: string;
  language: string;
  repositories?: string[];
  repositoryLists?: string[];
  repositoryOwners?: string[];
  queryPack: string;

  controllerRepoId: number;
}
