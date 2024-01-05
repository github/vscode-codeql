import { assertNever } from "../../common/helpers-pure";
import type { VariantAnalysisScannedRepositoryState } from "../shared/variant-analysis";
import { VariantAnalysisScannedRepositoryDownloadStatus } from "../shared/variant-analysis";
import type { VariantAnalysisScannedRepositoryStateDto } from "./repo-states-dto";
import { VariantAnalysisScannedRepositoryDownloadDto } from "./repo-states-dto";

export function mapRepoStatesToDomainModel(
  repoStates: Record<number, VariantAnalysisScannedRepositoryStateDto>,
): Record<number, VariantAnalysisScannedRepositoryState> {
  return Object.fromEntries(
    Object.entries(repoStates).map(([key, value]) => {
      return [key, mapRepoStateToDomainModel(value)];
    }),
  );
}

function mapRepoStateToDomainModel(
  repoState: VariantAnalysisScannedRepositoryStateDto,
): VariantAnalysisScannedRepositoryState {
  return {
    repositoryId: repoState.repositoryId,
    downloadStatus: mapDownloadStatusToDomainModel(repoState.downloadStatus),
    downloadPercentage: repoState.downloadPercentage,
  };
}

function mapDownloadStatusToDomainModel(
  downloadedStatus: VariantAnalysisScannedRepositoryDownloadDto,
) {
  switch (downloadedStatus) {
    case VariantAnalysisScannedRepositoryDownloadDto.Pending:
      return VariantAnalysisScannedRepositoryDownloadStatus.Pending;
    case VariantAnalysisScannedRepositoryDownloadDto.InProgress:
      return VariantAnalysisScannedRepositoryDownloadStatus.InProgress;
    case VariantAnalysisScannedRepositoryDownloadDto.Succeeded:
      return VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    case VariantAnalysisScannedRepositoryDownloadDto.Failed:
      return VariantAnalysisScannedRepositoryDownloadStatus.Failed;
    default:
      assertNever(downloadedStatus);
  }
}
