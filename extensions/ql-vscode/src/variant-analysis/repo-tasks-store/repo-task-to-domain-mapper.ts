import { assertNever } from "../../pure/helpers-pure";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisRepoStatus,
} from "../shared/variant-analysis";
import {
  VariantAnalysisRepositoryTaskData,
  VariantAnalysisRepoStatusData,
} from "./repo-task-data-types";

export function mapRepoTaskToDomain(
  repoTask: VariantAnalysisRepositoryTaskData,
): VariantAnalysisRepositoryTask {
  return {
    repository: {
      id: repoTask.repository.id,
      fullName: repoTask.repository.fullName,
      private: repoTask.repository.private,
    },
    analysisStatus: mapRepoTaskAnalysisStatusToDomain(repoTask.analysisStatus),
    resultCount: repoTask.resultCount,
    artifactSizeInBytes: repoTask.artifactSizeInBytes,
    failureMessage: repoTask.failureMessage,
    databaseCommitSha: repoTask.databaseCommitSha,
    sourceLocationPrefix: repoTask.sourceLocationPrefix,
    artifactUrl: repoTask.artifactUrl,
  };
}

function mapRepoTaskAnalysisStatusToDomain(
  analysisStatus: VariantAnalysisRepoStatusData,
): VariantAnalysisRepoStatus {
  switch (analysisStatus) {
    case VariantAnalysisRepoStatusData.Pending:
      return VariantAnalysisRepoStatus.Pending;
    case VariantAnalysisRepoStatusData.InProgress:
      return VariantAnalysisRepoStatus.InProgress;
    case VariantAnalysisRepoStatusData.Succeeded:
      return VariantAnalysisRepoStatus.Succeeded;
    case VariantAnalysisRepoStatusData.Failed:
      return VariantAnalysisRepoStatus.Failed;
    case VariantAnalysisRepoStatusData.Canceled:
      return VariantAnalysisRepoStatus.Canceled;
    case VariantAnalysisRepoStatusData.TimedOut:
      return VariantAnalysisRepoStatus.TimedOut;
    default:
      assertNever(analysisStatus);
  }
}
