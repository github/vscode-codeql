import type { Repository, RepositoryWithMetadata } from "./repository";
import type { AnalysisAlert, AnalysisRawResults } from "./analysis-result";
import { QueryLanguage } from "../../common/query-language";
import type { ModelPackDetails } from "../../common/model-pack-details";

export interface VariantAnalysis {
  id: number;
  controllerRepo: Repository;
  language: QueryLanguage;
  query: {
    name: string;
    filePath: string;
    text: string;
    kind?: string;
  };
  queries?: VariantAnalysisQueries;
  modelPacks?: ModelPackDetails[];
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

export function parseVariantAnalysisQueryLanguage(
  language: string,
): QueryLanguage | undefined {
  return Object.values(QueryLanguage).find((x) => x === language);
}

export enum VariantAnalysisStatus {
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceling = "canceling",
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
  downloadPercentage?: number;
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
  language: QueryLanguage;
  /** Base64 encoded query pack. */
  pack: string;
  query: {
    name: string;
    filePath: string;
    text: string;
    kind?: string;
  };
  queries?: VariantAnalysisQueries;
  databases: {
    repositories?: string[];
    repositoryLists?: string[];
    repositoryOwners?: string[];
  };
}

// Experimental information about the queries that are
// going to be run as part of the variant analysis.
// For now, this is just the query language, but it's
// unclear what it will look like in the future.
export interface VariantAnalysisQueries {
  language: QueryLanguage;
  count: number;
}

export async function isVariantAnalysisComplete(
  variantAnalysis: VariantAnalysis,
  artifactDownloaded: (
    repo: VariantAnalysisScannedRepository,
  ) => Promise<boolean>,
): Promise<boolean> {
  if (!isFinalVariantAnalysisStatus(variantAnalysis.status)) {
    return false;
  }

  if (
    variantAnalysis.scannedRepos === undefined ||
    variantAnalysis.scannedRepos.length === 0
  ) {
    return true;
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
 * @returns whether the repo scan completed successfully
 */
export function isRepoScanSuccessful(
  repo: VariantAnalysisScannedRepository,
): boolean {
  return repo.analysisStatus === VariantAnalysisRepoStatus.Succeeded;
}

/**
 * @param repo
 * @returns whether the repo scan has an artifact that can be downloaded
 */
export function repoHasDownloadableArtifact(
  repo: VariantAnalysisScannedRepository,
): boolean {
  return (
    repo.analysisStatus === VariantAnalysisRepoStatus.Succeeded &&
    repo.resultCount !== undefined &&
    repo.resultCount > 0
  );
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
  githubUrl: URL,
): string {
  const {
    actionsWorkflowRunId,
    controllerRepo: { fullName },
  } = variantAnalysis;
  return new URL(
    `/${fullName}/actions/runs/${actionsWorkflowRunId}`,
    githubUrl,
  ).toString();
}
