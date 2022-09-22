import * as React from 'react';
import { useMemo } from 'react';
import styled from 'styled-components';
import { VariantAnalysis, VariantAnalysisRepoStatus } from '../../remote-queries/shared/variant-analysis';
import { QueryDetails } from './QueryDetails';
import { VariantAnalysisActions } from './VariantAnalysisActions';
import { VariantAnalysisStats } from './VariantAnalysisStats';

export type VariantAnalysisHeaderProps = {
  variantAnalysis: VariantAnalysis;

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
  variantAnalysis,
  duration,
  completedAt,
  onOpenQueryFileClick,
  onViewQueryTextClick,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick,
  onViewLogsClick,
}: VariantAnalysisHeaderProps) => {
  const totalRepositoryCount = useMemo(() => {
    return variantAnalysis.scannedRepos?.length ?? 0;
  }, [variantAnalysis.scannedRepos]);
  const completedRepositoryCount = useMemo(() => {
    return variantAnalysis.scannedRepos?.filter(repo => [
      // All states that indicates the repository has been scanned and cannot
      // change status anymore.
      VariantAnalysisRepoStatus.Succeeded, VariantAnalysisRepoStatus.Failed,
      VariantAnalysisRepoStatus.Canceled, VariantAnalysisRepoStatus.TimedOut,
    ].includes(repo.analysisStatus))?.length ?? 0;
  }, [variantAnalysis.scannedRepos]);
  const resultCount = useMemo(() => {
    const reposWithResultCounts = variantAnalysis.scannedRepos?.filter(repo => repo.resultCount !== undefined);
    if (reposWithResultCounts === undefined || reposWithResultCounts.length === 0) {
      return undefined;
    }

    return reposWithResultCounts.map(repo => repo.resultCount ?? 0).reduce((a, b) => a + b, 0);
  }, [variantAnalysis.scannedRepos]);
  const hasSkippedRepos = useMemo(() => {
    if (!variantAnalysis.skippedRepos) {
      return false;
    }

    return Object.values(variantAnalysis.skippedRepos).some(skippedRepos => skippedRepos.length > 0);
  }, [variantAnalysis.skippedRepos]);

  return (
    <Container>
      <Row>
        <QueryDetails
          queryName={variantAnalysis.query.name}
          queryFileName={variantAnalysis.query.filePath}
          onOpenQueryFileClick={onOpenQueryFileClick}
          onViewQueryTextClick={onViewQueryTextClick}
        />
        <VariantAnalysisActions
          variantAnalysisStatus={variantAnalysis.status}
          onStopQueryClick={onStopQueryClick}
          onCopyRepositoryListClick={onCopyRepositoryListClick}
          onExportResultsClick={onExportResultsClick}
        />
      </Row>
      <VariantAnalysisStats
        variantAnalysisStatus={variantAnalysis.status}
        totalRepositoryCount={totalRepositoryCount}
        completedRepositoryCount={completedRepositoryCount}
        resultCount={resultCount}
        hasWarnings={hasSkippedRepos}
        duration={duration}
        completedAt={completedAt}
        onViewLogsClick={onViewLogsClick}
      />
    </Container>
  );
};
