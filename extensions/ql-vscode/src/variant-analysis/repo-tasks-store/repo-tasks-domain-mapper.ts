import { assertNever } from "../../common/helpers-pure";
import type { VariantAnalysisRepositoryTask } from "../shared/variant-analysis";
import { VariantAnalysisRepoStatus } from "../shared/variant-analysis";
import type { VariantAnalysisRepositoryTaskDto } from "./repo-tasks-dto";
import { VariantAnalysisRepoStatusDto } from "./repo-tasks-dto";

export function mapRepoTaskToDomainModel(
  repoTask: VariantAnalysisRepositoryTaskDto,
): VariantAnalysisRepositoryTask {
  return {
    repository: {
      id: repoTask.repository.id,
      fullName: repoTask.repository.fullName,
      private: repoTask.repository.private,
    },
    analysisStatus: mapRepoTaskAnalysisStatusToDomainModel(
      repoTask.analysisStatus,
    ),
    resultCount: repoTask.resultCount,
    artifactSizeInBytes: repoTask.artifactSizeInBytes,
    failureMessage: repoTask.failureMessage,
    databaseCommitSha: repoTask.databaseCommitSha,
    sourceLocationPrefix: repoTask.sourceLocationPrefix,
    artifactUrl: repoTask.artifactUrl,
  };
}

function mapRepoTaskAnalysisStatusToDomainModel(
  analysisStatus: VariantAnalysisRepoStatusDto,
): VariantAnalysisRepoStatus {
  switch (analysisStatus) {
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
      assertNever(analysisStatus);
  }
}
