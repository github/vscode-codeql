import * as React from 'react';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import ViewTitle from '../remote-queries/ViewTitle';
import { CodeSquareIcon, FileCodeIcon } from '@primer/octicons-react';
import { LinkIconButton } from './LinkIconButton';
import styled from 'styled-components';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

export type VariantAnalysisHeaderProps = {
  queryName: string;
  queryFileName: string;
  status: VariantAnalysisStatus;

  onOpenQueryClick: () => void;
  onViewQueryClick: () => void;

  onStopQueryClick: () => void;

  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;
};

const Wrapper = styled.div`
  display: flex;
  align-items: center;
`;

const HeaderWrapper = styled.div`
  max-width: 100%;
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 1em;
`;

const ActionsWrapper = styled.div`
  margin-left: auto;
  display: flex;
  gap: 1em;
`;

const Button = styled(VSCodeButton)`
  white-space: nowrap;
`;

export const VariantAnalysisHeader = ({
  queryName,
  queryFileName,
  status,
  onOpenQueryClick,
  onViewQueryClick,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick
}: VariantAnalysisHeaderProps) => {
  return (
    <Wrapper>
      <HeaderWrapper>
        <ViewTitle>{queryName}</ViewTitle>
        <HeaderButtons>
          <LinkIconButton onClick={onOpenQueryClick}>
            <FileCodeIcon size={16} />
            {queryFileName}
          </LinkIconButton>
          <LinkIconButton onClick={onViewQueryClick}>
            <CodeSquareIcon size={16} />
            View query
          </LinkIconButton>
        </HeaderButtons>
      </HeaderWrapper>
      <ActionsWrapper>
        {status === VariantAnalysisStatus.InProgress && (
          <VSCodeButton appearance="secondary" onClick={onStopQueryClick}>
            Stop query
          </VSCodeButton>
        )}
        {status === VariantAnalysisStatus.Succeeded && (
          <>
            <Button appearance="secondary" onClick={onCopyRepositoryListClick}>
              Copy repository list
            </Button>
            <Button appearance="primary" onClick={onExportResultsClick}>
              Export results
            </Button>
          </>
        )}
      </ActionsWrapper>
    </Wrapper>
  );
};
