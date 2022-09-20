import { Repository } from './repository';

export interface VariantAnalysis {
  id: number,
  controllerRepoId: number,
  query: {
    name: string,
    filePath: string,
    language: VariantAnalysisQueryLanguage
  },
  databases: {
    repositories?: string[],
    repositoryLists?: string[],
    repositoryOwners?: string[],
  },
  status: VariantAnalysisStatus,
  actionsWorkflowRunId?: number,
  failureReason?: VariantAnalysisFailureReason,
  scannedRepos?: VariantAnalysisScannedRepository[],
  skippedRepos?: VariantAnalysisSkippedRepositories
}

export enum VariantAnalysisQueryLanguage {
  CSharp = 'csharp',
  Cpp = 'cpp',
  Go = 'go',
  Java = 'java',
  Javascript = 'javascript',
  Python = 'python',
  Ruby = 'ruby'
}

export enum VariantAnalysisStatus {
  InProgress = 'inProgress',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export enum VariantAnalysisFailureReason {
  NoReposQueried = 'noReposQueried',
  InternalError = 'internalError',
}

export enum VariantAnalysisRepoStatus {
  Pending = 'pending',
  InProgress = 'inProgress',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Canceled = 'canceled',
  TimedOut = 'timedOut',
}

export interface VariantAnalysisScannedRepository {
  repository: Repository,
  analysisStatus: VariantAnalysisRepoStatus,
  resultCount?: number,
  artifactSizeInBytes?: number,
  failureMessage?: string
}

export interface VariantAnalysisSkippedRepositories {
  accessMismatchRepos?: VariantAnalysisSkippedRepositoryGroup,
  notFoundRepos?: VariantAnalysisSkippedRepositoryGroup,
  noCodeqlDbRepos?: VariantAnalysisSkippedRepositoryGroup,
  overLimitRepos?: VariantAnalysisSkippedRepositoryGroup
}

export interface VariantAnalysisSkippedRepositoryGroup {
  repositoryCount: number,
  repositories: Array<{
    id?: number,
    fullName: string
  }>
}
