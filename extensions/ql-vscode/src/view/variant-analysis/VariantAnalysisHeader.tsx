import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { QueryDetails } from './QueryDetails';
import { VariantAnalysisActions } from './VariantAnalysisActions';

export type VariantAnalysisHeaderProps = {
  queryName: string;
  queryFileName: string;
  variantAnalysisStatus: VariantAnalysisStatus;

  onOpenQueryFileClick: () => void;
  onViewQueryTextClick: () => void;

  onStopQueryClick: () => void;

  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;
};

const Container = styled.div`
  display: flex;
  align-items: center;
`;

export const VariantAnalysisHeader = ({
  queryName,
  queryFileName,
  variantAnalysisStatus,
  onOpenQueryFileClick,
  onViewQueryTextClick,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick
}: VariantAnalysisHeaderProps) => {
  return (
    <Container>
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
    </Container>
  );
};
