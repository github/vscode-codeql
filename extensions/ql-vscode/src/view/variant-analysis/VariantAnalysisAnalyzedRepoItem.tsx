import * as React from 'react';
import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { VSCodeBadge } from '@vscode/webview-ui-toolkit/react';
import { isCompletedAnalysisRepoStatus, VariantAnalysisRepoStatus } from '../../remote-queries/shared/variant-analysis';
import { formatDecimal } from '../../pure/number';
import { Codicon, ErrorIcon, LoadingIcon, SuccessIcon } from '../common';
import { Repository } from '../../remote-queries/shared/repository';
import { AnalysisAlert, AnalysisRawResults } from '../../remote-queries/shared/analysis-result';
import { AnalyzedRepoItemContent } from './AnalyzedRepoItemContent';

// This will ensure that these icons have a className which we can use in the TitleContainer
const ExpandCollapseCodicon = styled(Codicon)``;

const TitleContainer = styled.button`
  display: flex;
  gap: 0.5em;
  align-items: center;

  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;

  &:disabled {
    cursor: default;

    ${ExpandCollapseCodicon} {
      color: var(--vscode-disabledForeground);
    }
  }
`;

const Visibility = styled.span`
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
`;

export type VariantAnalysisAnalyzedRepoItemProps = {
  repository: Repository;
  status: VariantAnalysisRepoStatus;
  resultCount?: number;

  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
}

const getErrorLabel = (status: VariantAnalysisRepoStatus.Failed | VariantAnalysisRepoStatus.TimedOut | VariantAnalysisRepoStatus.Canceled): string => {
  switch (status) {
    case VariantAnalysisRepoStatus.Failed:
      return 'Failed';
    case VariantAnalysisRepoStatus.TimedOut:
      return 'Timed out';
    case VariantAnalysisRepoStatus.Canceled:
      return 'Canceled';
  }
};

export const VariantAnalysisAnalyzedRepoItem = ({
  repository,
  status,
  resultCount,
  interpretedResults,
  rawResults,
}: VariantAnalysisAnalyzedRepoItemProps) => {
  const [isExpanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded(oldIsExpanded => !oldIsExpanded);
  }, []);

  const disabled = !isCompletedAnalysisRepoStatus(status);

  return (
    <div>
      <TitleContainer onClick={toggleExpanded} disabled={disabled} aria-expanded={isExpanded}>
        {isExpanded ? <ExpandCollapseCodicon name="chevron-down" label="Collapse" /> : <ExpandCollapseCodicon name="chevron-right" label="Expand" />}
        <VSCodeBadge>{resultCount === undefined ? '-' : formatDecimal(resultCount)}</VSCodeBadge>
        <span>{repository.fullName}</span>
        <Visibility>{repository.private ? 'private' : 'public'}</Visibility>
        <span>
          {status === VariantAnalysisRepoStatus.Succeeded && <SuccessIcon />}
          {(status === VariantAnalysisRepoStatus.Failed || status === VariantAnalysisRepoStatus.TimedOut || status === VariantAnalysisRepoStatus.Canceled) && <ErrorIcon label={getErrorLabel(status)} />}
          {status === VariantAnalysisRepoStatus.InProgress && <LoadingIcon label="In progress" />}
        </span>
      </TitleContainer>
      {isExpanded && <AnalyzedRepoItemContent status={status} interpretedResults={interpretedResults} rawResults={rawResults} />}
    </div>
  );
};
