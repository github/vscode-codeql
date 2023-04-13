import { assertNever } from "../../pure/helpers-pure";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisRepoStatus,
} from "../shared/variant-analysis";
import {
  VariantAnalysisRepositoryTaskDto,
  VariantAnalysisRepoStatusDto,
} from "./repo-tasks-dto";

export function mapRepoTaskToData(
  repoTask: VariantAnalysisRepositoryTask,
): VariantAnalysisRepositoryTaskDto {
  return {
    repository: {
      id: repoTask.repository.id,
      fullName: repoTask.repository.fullName,
      private: repoTask.repository.private,
    },
    analysisStatus: mapRepoTaskAnalysisStatusToData(repoTask.analysisStatus),
    resultCount: repoTask.resultCount,
    artifactSizeInBytes: repoTask.artifactSizeInBytes,
    failureMessage: repoTask.failureMessage,
    databaseCommitSha: repoTask.databaseCommitSha,
    sourceLocationPrefix: repoTask.sourceLocationPrefix,
    artifactUrl: repoTask.artifactUrl,
  };
}

function mapRepoTaskAnalysisStatusToData(
  analysisStatus: VariantAnalysisRepoStatus,
): VariantAnalysisRepoStatusDto {
  switch (analysisStatus) {
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
      assertNever(analysisStatus);
  }
}
