import {
  QueryHistoryVariantAnalysisDto,
  QueryLanguageDto,
  QueryStatusDto,
  VariantAnalysisDto,
  VariantAnalysisFailureReasonDto,
  VariantAnalysisRepoStatusDto,
  VariantAnalysisScannedRepositoryDto,
  VariantAnalysisSkippedRepositoriesDto,
  VariantAnalysisSkippedRepositoryDto,
  VariantAnalysisSkippedRepositoryGroupDto,
  VariantAnalysisStatusDto,
} from "./query-history-variant-analysis-dto";
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepository,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { assertNever } from "../../common/helpers-pure";
import { QueryLanguage } from "../../common/query-language";
import { QueryStatus } from "../query-status";
import { VariantAnalysisHistoryItem } from "../variant-analysis-history-item";

export function mapQueryHistoryVariantAnalysisToDomainModel(
  item: QueryHistoryVariantAnalysisDto,
): VariantAnalysisHistoryItem {
  return {
    t: "variant-analysis",
    failureReason: item.failureReason,
    resultCount: item.resultCount,
    status: mapQueryStatusToDomainModel(item.status),
    completed: item.completed,
    variantAnalysis: mapVariantAnalysisToDomainModel(item.variantAnalysis),
    userSpecifiedLabel: item.userSpecifiedLabel,
  };
}

function mapVariantAnalysisToDomainModel(
  variantAnalysis: VariantAnalysisDto,
): VariantAnalysis {
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
      language: mapQueryLanguageToDomainModel(variantAnalysis.query.language),
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
    status: mapVariantAnalysisStatusToDomainModel(variantAnalysis.status),
    completedAt: variantAnalysis.completedAt,
    actionsWorkflowRunId: variantAnalysis.actionsWorkflowRunId,
    failureReason:
      variantAnalysis.failureReason &&
      mapVariantAnalysisFailureReasonToDomainModel(
        variantAnalysis.failureReason,
      ),
    scannedRepos:
      variantAnalysis.scannedRepos &&
      mapVariantAnalysisScannedRepositoriesToDomainModel(
        variantAnalysis.scannedRepos,
      ),
    skippedRepos:
      variantAnalysis.skippedRepos &&
      mapVariantAnalysisSkippedRepositoriesToDomainModel(
        variantAnalysis.skippedRepos,
      ),
  };
}

function mapVariantAnalysisScannedRepositoriesToDomainModel(
  repos: VariantAnalysisScannedRepositoryDto[],
): VariantAnalysisScannedRepository[] {
  return repos.map(mapVariantAnalysisScannedRepositoryToDomainModel);
}

function mapVariantAnalysisScannedRepositoryToDomainModel(
  repo: VariantAnalysisScannedRepositoryDto,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      id: repo.repository.id,
      fullName: repo.repository.fullName,
      private: repo.repository.private,
      stargazersCount: repo.repository.stargazersCount,
      updatedAt: repo.repository.updatedAt,
    },
    analysisStatus: mapVariantAnalysisRepoStatusToDomainModel(
      repo.analysisStatus,
    ),
    resultCount: repo.resultCount,
    artifactSizeInBytes: repo.artifactSizeInBytes,
    failureMessage: repo.failureMessage,
  };
}

function mapVariantAnalysisSkippedRepositoriesToDomainModel(
  repos: VariantAnalysisSkippedRepositoriesDto,
): VariantAnalysisSkippedRepositories {
  return {
    accessMismatchRepos:
      repos.accessMismatchRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDomainModel(
        repos.accessMismatchRepos,
      ),
    notFoundRepos:
      repos.notFoundRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDomainModel(
        repos.notFoundRepos,
      ),
    noCodeqlDbRepos:
      repos.noCodeqlDbRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDomainModel(
        repos.noCodeqlDbRepos,
      ),
    overLimitRepos:
      repos.overLimitRepos &&
      mapVariantAnalysisSkippedRepositoryGroupToDomainModel(
        repos.overLimitRepos,
      ),
  };
}

function mapVariantAnalysisSkippedRepositoryGroupToDomainModel(
  repoGroup: VariantAnalysisSkippedRepositoryGroupDto,
): VariantAnalysisSkippedRepositoryGroup {
  return {
    repositoryCount: repoGroup.repositoryCount,
    repositories: repoGroup.repositories.map(
      mapVariantAnalysisSkippedRepositoryToDomainModel,
    ),
  };
}

function mapVariantAnalysisSkippedRepositoryToDomainModel(
  repo: VariantAnalysisSkippedRepositoryDto,
): VariantAnalysisSkippedRepository {
  return {
    id: repo.id,
    fullName: repo.fullName,
    private: repo.private,
    stargazersCount: repo.stargazersCount,
    updatedAt: repo.updatedAt,
  };
}

function mapVariantAnalysisFailureReasonToDomainModel(
  failureReason: VariantAnalysisFailureReasonDto,
): VariantAnalysisFailureReason {
  switch (failureReason) {
    case VariantAnalysisFailureReasonDto.NoReposQueried:
      return VariantAnalysisFailureReason.NoReposQueried;
    case VariantAnalysisFailureReasonDto.ActionsWorkflowRunFailed:
      return VariantAnalysisFailureReason.ActionsWorkflowRunFailed;
    case VariantAnalysisFailureReasonDto.InternalError:
      return VariantAnalysisFailureReason.InternalError;
    default:
      assertNever(failureReason);
  }
}

function mapVariantAnalysisRepoStatusToDomainModel(
  status: VariantAnalysisRepoStatusDto,
): VariantAnalysisRepoStatus {
  switch (status) {
    case VariantAnalysisRepoStatusDto.Pending:
      return VariantAnalysisRepoStatus.Pending;
    case VariantAnalysisRepoStatusDto.InProgress:
      return VariantAnalysisRepoStatus.InProgress;
    case VariantAnalysisRepoStatusDto.Succeeded:
      return VariantAnalysisRepoStatus.Succeeded;
    case VariantAnalysisRepoStatusDto.Failed:
      return VariantAnalysisRepoStatus.Failed;
    case VariantAnalysisRepoStatusDto.Canceled:
      return VariantAnalysisRepoStatus.Canceled;
    case VariantAnalysisRepoStatusDto.TimedOut:
      return VariantAnalysisRepoStatus.TimedOut;
    default:
      assertNever(status);
  }
}

function mapVariantAnalysisStatusToDomainModel(
  status: VariantAnalysisStatusDto,
): VariantAnalysisStatus {
  switch (status) {
    case VariantAnalysisStatusDto.InProgress:
      return VariantAnalysisStatus.InProgress;
    case VariantAnalysisStatusDto.Succeeded:
      return VariantAnalysisStatus.Succeeded;
    case VariantAnalysisStatusDto.Failed:
      return VariantAnalysisStatus.Failed;
    case VariantAnalysisStatusDto.Canceled:
      return VariantAnalysisStatus.Canceled;
    default:
      assertNever(status);
  }
}

function mapQueryLanguageToDomainModel(
  language: QueryLanguageDto,
): QueryLanguage {
  switch (language) {
    case QueryLanguageDto.CSharp:
      return QueryLanguage.CSharp;
    case QueryLanguageDto.Cpp:
      return QueryLanguage.Cpp;
    case QueryLanguageDto.Go:
      return QueryLanguage.Go;
    case QueryLanguageDto.Java:
      return QueryLanguage.Java;
    case QueryLanguageDto.Javascript:
      return QueryLanguage.Javascript;
    case QueryLanguageDto.Python:
      return QueryLanguage.Python;
    case QueryLanguageDto.Ruby:
      return QueryLanguage.Ruby;
    case QueryLanguageDto.Swift:
      return QueryLanguage.Swift;
    default:
      assertNever(language);
  }
}

function mapQueryStatusToDomainModel(status: QueryStatusDto): QueryStatus {
  switch (status) {
    case QueryStatusDto.InProgress:
      return QueryStatus.InProgress;
    case QueryStatusDto.Completed:
      return QueryStatus.Completed;
    case QueryStatusDto.Failed:
      return QueryStatus.Failed;
    default:
      assertNever(status);
  }
}
