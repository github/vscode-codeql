import { QueryLanguage } from "../../common/query-language";
import { QueryStatus } from "../../query-status";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";

// Data Model for Variant Analysis Query History Items
// All data points are modelled, except enums.

export interface QueryHistoryVariantAnalysisDto {
  readonly t: "variant-analysis";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  variantAnalysis: VariantAnalysisQueryHistoryDto;
  userSpecifiedLabel?: string;
}

export interface VariantAnalysisQueryHistoryDto {
  id: number;
  controllerRepo: {
    id: number;
    fullName: string;
    private: boolean;
  };
  query: {
    name: string;
    filePath: string;
    language: QueryLanguage;
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
  analysisStatus: VariantAnalysisRepoStatus;
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
