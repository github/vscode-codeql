import type {
  QueryHistoryVariantAnalysisDto,
  VariantAnalysisDto,
  VariantAnalysisScannedRepositoryDto,
  VariantAnalysisSkippedRepositoriesDto,
  VariantAnalysisSkippedRepositoryDto,
  VariantAnalysisSkippedRepositoryGroupDto,
} from "./query-history-variant-analysis-dto";
import {
  QueryStatusDto,
  VariantAnalysisFailureReasonDto,
  VariantAnalysisRepoStatusDto,
  VariantAnalysisStatusDto,
} from "./query-history-variant-analysis-dto";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepository,
  VariantAnalysisSkippedRepositoryGroup,
} from "../../variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { assertNever } from "../../common/helpers-pure";
import { QueryStatus } from "../query-status";
import type { VariantAnalysisHistoryItem } from "../variant-analysis-history-item";
import { mapQueryLanguageToDto } from "./query-history-language-domain-mapper";

export function mapQueryHistoryVariantAnalysisToDto(
  item: VariantAnalysisHistoryItem,
): QueryHistoryVariantAnalysisDto {
  return {
    t: "variant-analysis",
    failureReason: item.failureReason,
    resultCount: item.resultCount,
    status: mapQueryStatusToDto(item.status),
    completed: item.completed,
    variantAnalysis: mapVariantAnalysisDtoToDto(item.variantAnalysis),
    userSpecifiedLabel: item.userSpecifiedLabel,
  };
}

function mapVariantAnalysisDtoToDto(
  variantAnalysis: VariantAnalysis,
): VariantAnalysisDto {
  return {
    id: variantAnalysis.id,
    controllerRepo: {
      id: variantAnalysis.controllerRepo.id,
      fullName: variantAnalysis.controllerRepo.fullName,
      private: variantAnalysis.controllerRepo.private,
    },
    query: {
      name: variantAnalysis.query.name,
      filePath: variantAnalysis.query.filePath,
      language: mapQueryLanguageToDto(variantAnalysis.language),
      text: variantAnalysis.query.text,
      kind: variantAnalysis.query.kind,
    },
    databases: {
      repositories: variantAnalysis.databases.repositories,
      repositoryLists: variantAnalysis.databases.repositoryLists,
      repositoryOwners: variantAnalysis.databases.repositoryOwners,
    },
    createdAt: variantAnalysis.createdAt,
    updatedAt: variantAnalysis.updatedAt,
    executionStartTime: variantAnalysis.executionStartTime,
    status: mapVariantAnalysisStatusToDto(variantAnalysis.status),
    completedAt: variantAnalysis.completedAt,
    actionsWorkflowRunId: variantAnalysis.actionsWorkflowRunId,
    failureReason:
      variantAnalysis.failureReason &&
      mapVariantAnalysisFailureReasonToDto(variantAnalysis.failureReason),
    scannedRepos:
      variantAnalysis.scannedRepos &&
      mapVariantAnalysisScannedRepositoriesToDto(variantAnalysis.scannedRepos),
    skippedRepos:
      variantAnalysis.skippedRepos &&
      mapVariantAnalysisSkippedRepositoriesToDto(variantAnalysis.skippedRepos),
  };
}

function mapVariantAnalysisScannedRepositoriesToDto(
  repos: VariantAnalysisScannedRepository[],
): VariantAnalysisScannedRepositoryDto[] {
  return repos.map(mapVariantAnalysisScannedRepositoryToDto);
}

function mapVariantAnalysisScannedRepositoryToDto(
  repo: VariantAnalysisScannedRepository,
): VariantAnalysisScannedRepositoryDto {
  return {
    repository: {
      id: repo.repository.id,
      fullName: repo.repository.fullName,
      private: repo.repository.private,
      stargazersCount: repo.repository.stargazersCount,
      updatedAt: repo.repository.updatedAt,
    },
    analysisStatus: mapVariantAnalysisRepoStatusToDto(repo.analysisStatus),
    resultCount: repo.resultCount,
    artifactSizeInBytes: repo.artifactSizeInBytes,
    failureMessage: repo.failureMessage,
  };
}

function mapVariantAnalysisSkippedRepositoriesToDto(
  repos: VariantAnalysisSkippedRepositories,
): VariantAnalysisSkippedRepositoriesDto {
  return {
    accessMismatchRepos:
      repos.accessMismatchRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDto(repos.accessMismatchRepos),
    notFoundRepos:
      repos.notFoundRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDto(repos.notFoundRepos),
    noCodeqlDbRepos:
      repos.noCodeqlDbRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDto(repos.noCodeqlDbRepos),
    overLimitRepos:
      repos.overLimitRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDto(repos.overLimitRepos),
  };
}

function mapVariantAnalysisSkippedRepositoryGroupToDto(
  repoGroup: VariantAnalysisSkippedRepositoryGroup,
): VariantAnalysisSkippedRepositoryGroupDto {
  return {
    repositoryCount: repoGroup.repositoryCount,
    repositories: repoGroup.repositories.map(
      mapVariantAnalysisSkippedRepositoryToDto,
    ),
  };
}

function mapVariantAnalysisSkippedRepositoryToDto(
  repo: VariantAnalysisSkippedRepository,
): VariantAnalysisSkippedRepositoryDto {
  return {
    id: repo.id,
    fullName: repo.fullName,
    private: repo.private,
    stargazersCount: repo.stargazersCount,
    updatedAt: repo.updatedAt,
  };
}

function mapVariantAnalysisFailureReasonToDto(
  failureReason: VariantAnalysisFailureReason,
): VariantAnalysisFailureReasonDto {
  switch (failureReason) {
    case VariantAnalysisFailureReason.NoReposQueried:
      return VariantAnalysisFailureReasonDto.NoReposQueried;
    case VariantAnalysisFailureReason.ActionsWorkflowRunFailed:
      return VariantAnalysisFailureReasonDto.ActionsWorkflowRunFailed;
    case VariantAnalysisFailureReason.InternalError:
      return VariantAnalysisFailureReasonDto.InternalError;
    default:
      assertNever(failureReason);
  }
}

function mapVariantAnalysisRepoStatusToDto(
  status: VariantAnalysisRepoStatus,
): VariantAnalysisRepoStatusDto {
  switch (status) {
    case VariantAnalysisRepoStatus.Pending:
      return VariantAnalysisRepoStatusDto.Pending;
    case VariantAnalysisRepoStatus.InProgress:
      return VariantAnalysisRepoStatusDto.InProgress;
    case VariantAnalysisRepoStatus.Succeeded:
      return VariantAnalysisRepoStatusDto.Succeeded;
    case VariantAnalysisRepoStatus.Failed:
      return VariantAnalysisRepoStatusDto.Failed;
    case VariantAnalysisRepoStatus.Canceled:
      return VariantAnalysisRepoStatusDto.Canceled;
    case VariantAnalysisRepoStatus.TimedOut:
      return VariantAnalysisRepoStatusDto.TimedOut;
    default:
      assertNever(status);
  }
}

function mapVariantAnalysisStatusToDto(
  status: VariantAnalysisStatus,
): VariantAnalysisStatusDto {
  switch (status) {
    case VariantAnalysisStatus.InProgress:
      return VariantAnalysisStatusDto.InProgress;
    case VariantAnalysisStatus.Succeeded:
      return VariantAnalysisStatusDto.Succeeded;
    case VariantAnalysisStatus.Failed:
      return VariantAnalysisStatusDto.Failed;
    case VariantAnalysisStatus.Canceling:
      // The canceling state shouldn't be persisted. We can just
      // assume that the analysis is still in progress, since the
      // canceling state is very short-lived.
      return VariantAnalysisStatusDto.InProgress;
    case VariantAnalysisStatus.Canceled:
      return VariantAnalysisStatusDto.Canceled;
    default:
      assertNever(status);
  }
}

function mapQueryStatusToDto(status: QueryStatus): QueryStatusDto {
  switch (status) {
    case QueryStatus.InProgress:
      return QueryStatusDto.InProgress;
    case QueryStatus.Completed:
      return QueryStatusDto.Completed;
    case QueryStatus.Failed:
      return QueryStatusDto.Failed;
    default:
      assertNever(status);
  }
}
