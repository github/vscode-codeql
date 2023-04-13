import { assertNever } from "../../pure/helpers-pure";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisRepoStatus,
} from "../shared/variant-analysis";
import {
  VariantAnalysisRepositoryTaskData,
  VariantAnalysisRepoStatusData,
} from "./repo-task-data-types";

export function mapRepoTaskToData(
  repoTask: VariantAnalysisRepositoryTask,
): VariantAnalysisRepositoryTaskData {
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
): VariantAnalysisRepoStatusData {
  switch (analysisStatus) {
    case VariantAnalysisRepoStatus.Pending:
      return VariantAnalysisRepoStatusData.Pending;
    case VariantAnalysisRepoStatus.InProgress:
      return VariantAnalysisRepoStatusData.InProgress;
    case VariantAnalysisRepoStatus.Succeeded:
      return VariantAnalysisRepoStatusData.Succeeded;
    case VariantAnalysisRepoStatus.Failed:
      return VariantAnalysisRepoStatusData.Failed;
    case VariantAnalysisRepoStatus.Canceled:
      return VariantAnalysisRepoStatusData.Canceled;
    case VariantAnalysisRepoStatus.TimedOut:
      return VariantAnalysisRepoStatusData.TimedOut;
    default:
      assertNever(analysisStatus);
  }
}
