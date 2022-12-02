import { Repository, RepositoryWithMetadata } from "./repository";
import { AnalysisAlert, AnalysisRawResults } from "./analysis-result";

export interface VariantAnalysis {
  id: number;
  controllerRepo: Repository;
  query: {
    name: string;
    filePath: string;
    language: VariantAnalysisQueryLanguage;
    text: string;
  };
  databases: {
    repositories?: string[];
    repositoryLists?: string[];
    repositoryOwners?: string[];
  };
  createdAt: string;
  updatedAt: string;
  executionStartTime: number;
  status: VariantAnalysisStatus;
  completedAt?: string;
  actionsWorkflowRunId?: number;
  failureReason?: VariantAnalysisFailureReason;
  scannedRepos?: VariantAnalysisScannedRepository[];
  skippedRepos?: VariantAnalysisSkippedRepositories;
}

export enum VariantAnalysisQueryLanguage {
  CSharp = "csharp",
  Cpp = "cpp",
  Go = "go",
  Java = "java",
  Javascript = "javascript",
  Python = "python",
  Ruby = "ruby",
  Swift = "swift",
}

export function parseVariantAnalysisQueryLanguage(
  language: string,
): VariantAnalysisQueryLanguage | undefined {
  return Object.values(VariantAnalysisQueryLanguage).find(
    (x) => x === language,
  );
}

export enum VariantAnalysisStatus {
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export function isFinalVariantAnalysisStatus(
  status: VariantAnalysisStatus,
): boolean {
  return [
    // All states that indicates the analysis has completed and cannot change status anymore.
    VariantAnalysisStatus.Succeeded,
    VariantAnalysisStatus.Failed,
    VariantAnalysisStatus.Canceled,
  ].includes(status);
}

export enum VariantAnalysisFailureReason {
  NoReposQueried = "noReposQueried",
  ActionsWorkflowRunFailed = "actionsWorkflowRunFailed",
  InternalError = "internalError",
}

export enum VariantAnalysisRepoStatus {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  TimedOut = "timedOut",
}

export interface VariantAnalysisScannedRepository {
  repository: RepositoryWithMetadata;
  analysisStatus: VariantAnalysisRepoStatus;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
}

export interface VariantAnalysisRepositoryTask {
  repository: Repository;
  analysisStatus: VariantAnalysisRepoStatus;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
  databaseCommitSha?: string;
  sourceLocationPrefix?: string;
  artifactUrl?: string;
}

export interface VariantAnalysisSkippedRepositories {
  accessMismatchRepos?: VariantAnalysisSkippedRepositoryGroup;
  notFoundRepos?: VariantAnalysisSkippedRepositoryGroup;
  noCodeqlDbRepos?: VariantAnalysisSkippedRepositoryGroup;
  overLimitRepos?: VariantAnalysisSkippedRepositoryGroup;
}

export interface VariantAnalysisSkippedRepositoryGroup {
  repositoryCount: number;
  repositories: VariantAnalysisSkippedRepository[];
}

export interface VariantAnalysisSkippedRepository {
  id?: number;
  fullName: string;
  private?: boolean;
  stargazersCount?: number;
  updatedAt?: string | null;
}

export enum VariantAnalysisScannedRepositoryDownloadStatus {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
}

export interface VariantAnalysisScannedRepositoryState {
  repositoryId: number;
  downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus;
}

export interface VariantAnalysisScannedRepositoryResult {
  variantAnalysisId: number;
  repositoryId: number;
  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
}

/**
 * Captures information needed to submit a variant
 * analysis for processing.
 */
export interface VariantAnalysisSubmission {
  startTime: number;
  controllerRepoId: number;
  actionRepoRef: string;
  query: {
    name: string;
    filePath: string;
    language: VariantAnalysisQueryLanguage;
    text: string;

    // Base64 encoded query pack.
    pack: string;
  };
  databases: {
    repositories?: string[];
    repositoryLists?: string[];
    repositoryOwners?: string[];
  };
}

export async function isVariantAnalysisComplete(
  variantAnalysis: VariantAnalysis,
  artifactDownloaded: (
    repo: VariantAnalysisScannedRepository,
  ) => Promise<boolean>,
): Promise<boolean> {
  // It's only acceptable to have no scanned repos if the variant analysis is not in a final state.
  // Otherwise it means the analysis hit some kind of internal error or there were no repos to scan.
  if (
    variantAnalysis.scannedRepos === undefined ||
    variantAnalysis.scannedRepos.length === 0
  ) {
    return variantAnalysis.status !== VariantAnalysisStatus.InProgress;
  }

  return (
    await Promise.all(
      variantAnalysis.scannedRepos.map((repo) =>
        isVariantAnalysisRepoComplete(repo, artifactDownloaded),
      ),
    )
  ).every((x) => x);
}

async function isVariantAnalysisRepoComplete(
  repo: VariantAnalysisScannedRepository,
  artifactDownloaded: (
    repo: VariantAnalysisScannedRepository,
  ) => Promise<boolean>,
): Promise<boolean> {
  return (
    hasRepoScanCompleted(repo) &&
    (!repoHasDownloadableArtifact(repo) || (await artifactDownloaded(repo)))
  );
}

/**
 * @param status
 * @returns whether the status is in a completed state, i.e. it cannot normally change state anymore
 */
export function isCompletedAnalysisRepoStatus(
  status: VariantAnalysisRepoStatus,
): boolean {
  return [
    // All states that indicates the repository has been scanned and cannot
    // change status anymore.
    VariantAnalysisRepoStatus.Succeeded,
    VariantAnalysisRepoStatus.Failed,
    VariantAnalysisRepoStatus.Canceled,
    VariantAnalysisRepoStatus.TimedOut,
  ].includes(status);
}

/**
 * @param repo
 * @returns whether the repo scan is in a completed state, i.e. it cannot normally change state anymore
 */
export function hasRepoScanCompleted(
  repo: VariantAnalysisScannedRepository,
): boolean {
  return isCompletedAnalysisRepoStatus(repo.analysisStatus);
}

/**
 * @param repo
 * @returns whether the repo scan has an artifact that can be downloaded
 */
export function repoHasDownloadableArtifact(
  repo: VariantAnalysisScannedRepository,
): boolean {
  return repo.analysisStatus === VariantAnalysisRepoStatus.Succeeded;
}

/**
 * @param repos
 * @returns the total number of results. Will be `undefined` when there are no repos with results.
 */
export function getTotalResultCount(
  repos: VariantAnalysisScannedRepository[] | undefined,
): number | undefined {
  const reposWithResultCounts = repos?.filter(
    (repo) => repo.resultCount !== undefined,
  );
  if (
    reposWithResultCounts === undefined ||
    reposWithResultCounts.length === 0
  ) {
    return undefined;
  }

  return reposWithResultCounts.reduce(
    (acc, repo) => acc + (repo.resultCount ?? 0),
    0,
  );
}

/**
 * @param skippedRepos
 * @returns the total number of skipped repositories.
 */
export function getSkippedRepoCount(
  skippedRepos: VariantAnalysisSkippedRepositories | undefined,
): number {
  if (!skippedRepos) {
    return 0;
  }

  return Object.values(skippedRepos).reduce(
    (acc, group) => acc + group.repositoryCount,
    0,
  );
}

export function getActionsWorkflowRunUrl(
  variantAnalysis: VariantAnalysis,
): string {
  const {
    actionsWorkflowRunId,
    controllerRepo: { fullName },
  } = variantAnalysis;
  return `https://github.com/${fullName}/actions/runs/${actionsWorkflowRunId}`;
}
