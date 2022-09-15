import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import ViewTitle from '../remote-queries/ViewTitle';
import { LinkIconButton } from './LinkIconButton';
import { VariantAnalysisHeaderActions } from './VariantAnalysisHeaderActions';

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

const QueryDetails = styled.div`
  max-width: 100%;
`;

const QueryActions = styled.div`
  display: flex;
  gap: 1em;
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
      <QueryDetails>
        <ViewTitle>{queryName}</ViewTitle>
        <QueryActions>
          <LinkIconButton onClick={onOpenQueryFileClick}>
            <span slot="start" className="codicon codicon-file-code"></span>
            {queryFileName}
          </LinkIconButton>
          <LinkIconButton onClick={onViewQueryTextClick}>
            <span slot="start" className="codicon codicon-code"></span>
            View query
          </LinkIconButton>
        </QueryActions>
      </QueryDetails>
      <VariantAnalysisHeaderActions
        variantAnalysisStatus={variantAnalysisStatus}
        onStopQueryClick={onStopQueryClick}
        onCopyRepositoryListClick={onCopyRepositoryListClick}
        onExportResultsClick={onExportResultsClick}
      />
    </Container>
  );
};
