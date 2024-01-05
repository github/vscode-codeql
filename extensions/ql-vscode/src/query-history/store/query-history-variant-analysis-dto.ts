// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import type { QueryLanguageDto } from "./query-history-dto";

export interface QueryHistoryVariantAnalysisDto {
  readonly t: "variant-analysis";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatusDto;
  completed: boolean;
  variantAnalysis: VariantAnalysisDto;
  userSpecifiedLabel?: string;
}

export interface VariantAnalysisDto {
  id: number;
  controllerRepo: {
    id: number;
    fullName: string;
    private: boolean;
  };
  query: {
    name: string;
    filePath: string;
    language: QueryLanguageDto;
    text: string;
    kind?: string;
  };
  databases: {
    repositories?: string[];
    repositoryLists?: string[];
    repositoryOwners?: string[];
  };
  createdAt: string;
  updatedAt: string;
  executionStartTime: number;
  status: VariantAnalysisStatusDto;
  completedAt?: string;
  actionsWorkflowRunId?: number;
  failureReason?: VariantAnalysisFailureReasonDto;
  scannedRepos?: VariantAnalysisScannedRepositoryDto[];
  skippedRepos?: VariantAnalysisSkippedRepositoriesDto;
}

export interface VariantAnalysisScannedRepositoryDto {
  repository: {
    id: number;
    fullName: string;
    private: boolean;
    stargazersCount: number;
    updatedAt: string | null;
  };
  analysisStatus: VariantAnalysisRepoStatusDto;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
}

export interface VariantAnalysisSkippedRepositoriesDto {
  accessMismatchRepos?: VariantAnalysisSkippedRepositoryGroupDto;
  notFoundRepos?: VariantAnalysisSkippedRepositoryGroupDto;
  noCodeqlDbRepos?: VariantAnalysisSkippedRepositoryGroupDto;
  overLimitRepos?: VariantAnalysisSkippedRepositoryGroupDto;
}

export interface VariantAnalysisSkippedRepositoryGroupDto {
  repositoryCount: number;
  repositories: VariantAnalysisSkippedRepositoryDto[];
}

export interface VariantAnalysisSkippedRepositoryDto {
  id?: number;
  fullName: string;
  private?: boolean;
  stargazersCount?: number;
  updatedAt?: string | null;
}

export enum VariantAnalysisFailureReasonDto {
  NoReposQueried = "noReposQueried",
  ActionsWorkflowRunFailed = "actionsWorkflowRunFailed",
  InternalError = "internalError",
}

export enum VariantAnalysisRepoStatusDto {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  TimedOut = "timedOut",
}

export enum VariantAnalysisStatusDto {
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export enum QueryStatusDto {
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
}
