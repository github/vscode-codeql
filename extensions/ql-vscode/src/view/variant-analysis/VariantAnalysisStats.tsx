import * as React from 'react';
import { useMemo } from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { StatItem } from './StatItem';
import { formatDecimal } from '../../pure/number';
import { humanizeUnit } from '../../pure/time';
import { VariantAnalysisRepositoriesStats } from './VariantAnalysisRepositoriesStats';
import { VariantAnalysisCompletionStats } from './VariantAnalysisCompletionStats';

export type VariantAnalysisStatsProps = {
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount?: number | undefined;

  queryResult?: 'warning' | 'stopped';

  resultCount?: number | undefined;
  duration?: number | undefined;
  completedAt?: Date | undefined;

  onViewLogsClick: () => void;
};

const Row = styled.div`
  display: flex;
  width: 100%;
  gap: 1em;
`;

export const VariantAnalysisStats = ({
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount = 0,
  queryResult,
  resultCount,
  duration,
  completedAt,
  onViewLogsClick,
}: VariantAnalysisStatsProps) => {
  const completionHeaderName = useMemo(() => {
    if (variantAnalysisStatus === VariantAnalysisStatus.InProgress) {
      return 'Running';
    }

    if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
      return 'Failed';
    }

    if (queryResult === 'warning') {
      return 'Succeeded warnings';
    }

    if (queryResult === 'stopped') {
      return 'Stopped';
    }

    return 'Succeeded';
  }, [variantAnalysisStatus, queryResult]);

  return (
    <Row>
      <StatItem title="Results">
        {resultCount !== undefined ? formatDecimal(resultCount) : '-'}
      </StatItem>
      <StatItem title="Repositories">
        <VariantAnalysisRepositoriesStats
          variantAnalysisStatus={variantAnalysisStatus}
          totalRepositoryCount={totalRepositoryCount}
          completedRepositoryCount={completedRepositoryCount}
          queryResult={queryResult}
          completedAt={completedAt}
        />
      </StatItem>
      <StatItem title="Duration">
        {duration !== undefined ? humanizeUnit(duration) : '-'}
      </StatItem>
      <StatItem title={completionHeaderName}>
        <VariantAnalysisCompletionStats
          completedAt={completedAt}
          onViewLogsClick={onViewLogsClick}
        />
      </StatItem>
    </Row>
  );
};
