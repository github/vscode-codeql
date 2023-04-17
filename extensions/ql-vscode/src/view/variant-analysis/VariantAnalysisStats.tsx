import * as React from "react";
import { useMemo } from "react";
import styled from "styled-components";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { StatItem } from "./StatItem";
import { formatDecimal } from "../../pure/number";
import { humanizeUnit } from "../../pure/time";
import { VariantAnalysisRepositoriesStats } from "./VariantAnalysisRepositoriesStats";
import { VariantAnalysisStatusStats } from "./VariantAnalysisStatusStats";

export type VariantAnalysisStatsProps = {
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount: number;

  hasWarnings?: boolean;

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
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount,
  hasWarnings,
  resultCount,
  createdAt,
  completedAt,
  onViewLogsClick,
}: VariantAnalysisStatsProps) => {
  const completionHeaderName = useMemo(() => {
    if (variantAnalysisStatus === VariantAnalysisStatus.InProgress) {
      return "Running";
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
      return "Failed";
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Canceled) {
      return "Stopped";
    }

    if (
      variantAnalysisStatus === VariantAnalysisStatus.Succeeded &&
      hasWarnings
    ) {
      return "Succeeded warnings";
    }

    return "Succeeded";
  }, [variantAnalysisStatus, hasWarnings]);

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
          totalRepositoryCount={totalRepositoryCount}
          completedRepositoryCount={completedRepositoryCount}
          showWarning={hasWarnings}
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
