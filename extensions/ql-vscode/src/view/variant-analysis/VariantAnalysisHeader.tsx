import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { QueryDetails } from './QueryDetails';
import { VariantAnalysisActions } from './VariantAnalysisActions';
import { VariantAnalysisStats } from './VariantAnalysisStats';

export type VariantAnalysisHeaderProps = {
  queryName: string;
  queryFileName: string;
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount?: number | undefined;

  queryResult?: 'warning' | 'stopped';

  resultCount?: number | undefined;
  duration?: number | undefined;
  completedAt?: Date | undefined;

  onOpenQueryFileClick: () => void;
  onViewQueryTextClick: () => void;

  onStopQueryClick: () => void;

  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;

  onViewLogsClick: () => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2em;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
`;

export const VariantAnalysisHeader = ({
  queryName,
  queryFileName,
  totalRepositoryCount,
  completedRepositoryCount,
  queryResult,
  resultCount,
  duration,
  completedAt,
  variantAnalysisStatus,
  onOpenQueryFileClick,
  onViewQueryTextClick,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick,
  onViewLogsClick,
}: VariantAnalysisHeaderProps) => {
  return (
    <Container>
      <Row>
        <QueryDetails
          queryName={queryName}
          queryFileName={queryFileName}
          onOpenQueryFileClick={onOpenQueryFileClick}
          onViewQueryTextClick={onViewQueryTextClick}
        />
        <VariantAnalysisActions
          variantAnalysisStatus={variantAnalysisStatus}
          onStopQueryClick={onStopQueryClick}
          onCopyRepositoryListClick={onCopyRepositoryListClick}
          onExportResultsClick={onExportResultsClick}
        />
      </Row>
      <VariantAnalysisStats
        variantAnalysisStatus={variantAnalysisStatus}
        totalRepositoryCount={totalRepositoryCount}
        completedRepositoryCount={completedRepositoryCount}
        queryResult={queryResult}
        resultCount={resultCount}
        duration={duration}
        completedAt={completedAt}
        onViewLogsClick={onViewLogsClick}
      />
    </Container>
  );
};
