import { Repository } from './repository';
import { AnalysisAlert, AnalysisRawResults } from './analysis-result';

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

export function parseVariantAnalysisQueryLanguage(language: string): VariantAnalysisQueryLanguage | undefined {
  return Object.values(VariantAnalysisQueryLanguage).find(x => x === language);
}

export enum VariantAnalysisStatus {
  InProgress = 'inProgress',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Canceled = 'canceled',
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
  repositories: VariantAnalysisSkippedRepository[],
}

export interface VariantAnalysisSkippedRepository {
  id?: number,
  fullName: string,
  private?: boolean,
}

export interface VariantAnalysisScannedRepositoryResult {
  repositoryId: number;
  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
}

/**
 * Captures information needed to submit a variant
 * analysis for processing.
 */
export interface VariantAnalysisSubmission {
  startTime: number,
  controllerRepoId: number,
  actionRepoRef: string,
  query: {
    name: string,
    filePath: string,
    language: VariantAnalysisQueryLanguage,

    // Base64 encoded query pack.
    pack: string,
  },
  databases: {
    repositories?: string[],
    repositoryLists?: string[],
    repositoryOwners?: string[],
  }
}

/**
 * @param status
 * @returns whether the status is in a completed state, i.e. it cannot normally change state anymore
 */
export function isCompletedAnalysisRepoStatus(status: VariantAnalysisRepoStatus): boolean {
  return [
    // All states that indicates the repository has been scanned and cannot
    // change status anymore.
    VariantAnalysisRepoStatus.Succeeded, VariantAnalysisRepoStatus.Failed,
    VariantAnalysisRepoStatus.Canceled, VariantAnalysisRepoStatus.TimedOut,
  ].includes(status);
}

/**
 * @param repo
 * @returns whether the repo scan is in a completed state, i.e. it cannot normally change state anymore
 */
export function hasRepoScanCompleted(repo: VariantAnalysisScannedRepository): boolean {
  return isCompletedAnalysisRepoStatus(repo.analysisStatus);
}

/**
 * @param repos
 * @returns the total number of results. Will be `undefined` when there are no repos with results.
 */
export function getTotalResultCount(repos: VariantAnalysisScannedRepository[] | undefined): number | undefined {
  const reposWithResultCounts = repos?.filter(repo => repo.resultCount !== undefined);
  if (reposWithResultCounts === undefined || reposWithResultCounts.length === 0) {
    return undefined;
  }

  return reposWithResultCounts.reduce((acc, repo) => acc + (repo.resultCount ?? 0), 0);
}

/**
 * @param skippedRepos
 * @returns the total number of skipped repositories.
 */
export function getSkippedRepoCount(skippedRepos: VariantAnalysisSkippedRepositories | undefined): number {
  if (!skippedRepos) {
    return 0;
  }

  return Object.values(skippedRepos).reduce((acc, group) => acc + group.repositoryCount, 0);
}
