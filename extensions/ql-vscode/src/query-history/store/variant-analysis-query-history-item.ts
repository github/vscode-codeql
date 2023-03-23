import { QueryLanguage } from "../../common/query-language";
import { QueryStatus } from "../../query-status";
import { Repository } from "../../variant-analysis/shared/repository";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";

export interface VariantAnalysisQueryHistoryItem {
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
  controllerRepo: Repository;
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
  scannedRepos?: VariantAnalysisScannedRepository[];
  skippedRepos?: VariantAnalysisSkippedRepositories;
}
