import { assertNever } from "../../common/helpers-pure";
import type { VariantAnalysisScannedRepositoryState } from "../shared/variant-analysis";
import { VariantAnalysisScannedRepositoryDownloadStatus } from "../shared/variant-analysis";
import type { VariantAnalysisScannedRepositoryStateDto } from "./repo-states-dto";
import { VariantAnalysisScannedRepositoryDownloadDto } from "./repo-states-dto";

export function mapRepoStatesToDto(
  repoStates: Record<number, VariantAnalysisScannedRepositoryState>,
): Record<number, VariantAnalysisScannedRepositoryStateDto> {
  return Object.fromEntries(
    Object.entries(repoStates).map(([key, value]) => {
      return [key, mapRepoStateToDto(value)];
    }),
  );
}

function mapRepoStateToDto(
  repoState: VariantAnalysisScannedRepositoryState,
): VariantAnalysisScannedRepositoryStateDto {
  return {
    repositoryId: repoState.repositoryId,
    downloadStatus: mapDownloadStatusToDto(repoState.downloadStatus),
    downloadPercentage: repoState.downloadPercentage,
  };
}

function mapDownloadStatusToDto(
  downloadedStatus: VariantAnalysisScannedRepositoryDownloadStatus,
) {
  switch (downloadedStatus) {
    case VariantAnalysisScannedRepositoryDownloadStatus.Pending:
      return VariantAnalysisScannedRepositoryDownloadDto.Pending;
    case VariantAnalysisScannedRepositoryDownloadStatus.InProgress:
      return VariantAnalysisScannedRepositoryDownloadDto.InProgress;
    case VariantAnalysisScannedRepositoryDownloadStatus.Succeeded:
      return VariantAnalysisScannedRepositoryDownloadDto.Succeeded;
    case VariantAnalysisScannedRepositoryDownloadStatus.Failed:
      return VariantAnalysisScannedRepositoryDownloadDto.Failed;
    default:
      assertNever(downloadedStatus);
  }
}
