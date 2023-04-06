import { QueryLanguage } from "../../common/query-language";
import { QueryStatus } from "../../query-status";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";

// Data Model for Variant Analysis Query History Items
// All data points are modelled, except enums.

export interface VariantAnalysisDataItem {
  readonly t: "variant-analysis";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  variantAnalysis: VariantAnalysisQueryHistoryData;
  userSpecifiedLabel?: string;
}

export interface VariantAnalysisQueryHistoryData {
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
  scannedRepos?: VariantAnalysisScannedRepositoryData[];
  skippedRepos?: VariantAnalysisSkippedRepositoriesData;
}

export interface VariantAnalysisScannedRepositoryData {
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

export interface VariantAnalysisSkippedRepositoriesData {
  accessMismatchRepos?: VariantAnalysisSkippedRepositoryGroupData;
  notFoundRepos?: VariantAnalysisSkippedRepositoryGroupData;
  noCodeqlDbRepos?: VariantAnalysisSkippedRepositoryGroupData;
  overLimitRepos?: VariantAnalysisSkippedRepositoryGroupData;
}

export interface VariantAnalysisSkippedRepositoryGroupData {
  repositoryCount: number;
  repositories: VariantAnalysisSkippedRepositoryData[];
}

export interface VariantAnalysisSkippedRepositoryData {
  id?: number;
  fullName: string;
  private?: boolean;
  stargazersCount?: number;
  updatedAt?: string | null;
}
