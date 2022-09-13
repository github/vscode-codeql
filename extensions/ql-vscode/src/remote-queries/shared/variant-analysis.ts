export interface VariantAnalysisSubmission {
  startTime: number,
  controllerRepoId: number,
  actionRepoRef: string,
  query: {
    name: string,
    filePath: string,
    language: string,

    // Base64 encoded query pack.
    pack: string,
  },
  databases: {
    repositories?: string[],
    repositoryLists?: string[],
    repositoryOwners?: string[],
  }
}
