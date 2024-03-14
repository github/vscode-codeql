import { useMemo } from "react";
import { styled } from "styled-components";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisStatus,
  getSkippedRepoCount,
  hasRepoScanCompleted,
  isRepoScanSuccessful,
} from "../../variant-analysis/shared/variant-analysis";
import { StatItem } from "./StatItem";
import { formatDecimal } from "../../common/number";
import { humanizeUnit } from "../../common/time";
import { VariantAnalysisRepositoriesStats } from "./VariantAnalysisRepositoriesStats";
import { VariantAnalysisStatusStats } from "./VariantAnalysisStatusStats";

export type VariantAnalysisStatsProps = {
  variantAnalysis: VariantAnalysis;

  resultCount?: number | undefined;
  createdAt: Date;
  completedAt?: Date | undefined;

  onViewLogsClick?: () => void;
};

const Row = styled.div`
  display: flex;
  width: 100%;
  gap: 1em;
`;

export const VariantAnalysisStats = ({
  variantAnalysis,
  resultCount,
  createdAt,
  completedAt,
  onViewLogsClick,
}: VariantAnalysisStatsProps) => {
  const variantAnalysisStatus = variantAnalysis.status;
  const totalScannedRepositoryCount = useMemo(() => {
    return variantAnalysis.scannedRepos?.length ?? 0;
  }, [variantAnalysis.scannedRepos]);
  const completedRepositoryCount = useMemo(() => {
    return (
      variantAnalysis.scannedRepos?.filter((repo) => hasRepoScanCompleted(repo))
        ?.length ?? 0
    );
  }, [variantAnalysis.scannedRepos]);
  const successfulRepositoryCount = useMemo(() => {
    return (
      variantAnalysis.scannedRepos?.filter((repo) => isRepoScanSuccessful(repo))
        ?.length ?? 0
    );
  }, [variantAnalysis.scannedRepos]);
  const skippedRepositoryCount = useMemo(() => {
    return getSkippedRepoCount(variantAnalysis.skippedRepos);
  }, [variantAnalysis.skippedRepos]);
  const completionHeaderName = useMemo(() => {
    if (variantAnalysisStatus === VariantAnalysisStatus.InProgress) {
      return "Running";
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
      return "Failed";
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Canceling) {
      return "Canceling";
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Canceled) {
      return "Stopped";
    }

    if (
      variantAnalysisStatus === VariantAnalysisStatus.Succeeded &&
      successfulRepositoryCount < completedRepositoryCount
    ) {
      return "Some analyses failed";
    }

    return "Succeeded";
  }, [
    variantAnalysisStatus,
    successfulRepositoryCount,
    completedRepositoryCount,
  ]);

  const duration = useMemo(() => {
    if (!completedAt) {
      return undefined;
    }

    return completedAt.getTime() - createdAt.getTime();
  }, [completedAt, createdAt]);

  return (
    <Row>
      <StatItem title="Results">
        {resultCount !== undefined ? formatDecimal(resultCount) : "-"}
      </StatItem>
      <StatItem title="Repositories">
        <VariantAnalysisRepositoriesStats
          variantAnalysisStatus={variantAnalysisStatus}
          totalRepositoryCount={totalScannedRepositoryCount}
          completedRepositoryCount={completedRepositoryCount}
          successfulRepositoryCount={successfulRepositoryCount}
          skippedRepositoryCount={skippedRepositoryCount}
        />
      </StatItem>
      <StatItem title="Duration">
        {duration !== undefined ? humanizeUnit(duration) : "-"}
      </StatItem>
      <StatItem title={completionHeaderName}>
        <VariantAnalysisStatusStats
          variantAnalysisStatus={variantAnalysisStatus}
          completedAt={completedAt}
          onViewLogsClick={onViewLogsClick}
        />
      </StatItem>
    </Row>
  );
};
