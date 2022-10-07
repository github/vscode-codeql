import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { VSCodeBadge, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import {
  isCompletedAnalysisRepoStatus,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus
} from '../../remote-queries/shared/variant-analysis';
import { formatDecimal } from '../../pure/number';
import { Codicon, ErrorIcon, LoadingIcon, SuccessIcon, WarningIcon } from '../common';
import { Repository } from '../../remote-queries/shared/repository';
import { AnalysisAlert, AnalysisRawResults } from '../../remote-queries/shared/analysis-result';
import { vscode } from '../vscode-api';
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

const VisibilityText = styled.span`
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
`;

type VisibilityProps = {
  isPrivate?: boolean;
}

const Visibility = ({ isPrivate }: VisibilityProps) => {
  if (isPrivate === undefined) {
    return null;
  }
  return <VisibilityText>{isPrivate ? 'private' : 'public'}</VisibilityText>;
};

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

export type RepoRowProps = {
  // Only fullName is required
  repository: Partial<Repository> & Pick<Repository, 'fullName'>;
  status?: VariantAnalysisRepoStatus;
  downloadStatus?: VariantAnalysisScannedRepositoryDownloadStatus;
  resultCount?: number;

  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
}

export const RepoRow = ({
  repository,
  status,
  downloadStatus,
  resultCount,
  interpretedResults,
  rawResults,
}: RepoRowProps) => {
  const [isExpanded, setExpanded] = useState(false);
  const resultsLoaded = !!interpretedResults || !!rawResults;
  const [resultsLoading, setResultsLoading] = useState(false);

  const toggleExpanded = useCallback(async () => {
    if (resultsLoading) {
      return;
    }

    if (resultsLoaded) {
      setExpanded(oldIsExpanded => !oldIsExpanded);
      return;
    }

    vscode.postMessage({
      t: 'requestRepositoryResults',
      repositoryFullName: repository.fullName,
    });

    setResultsLoading(true);
  }, [resultsLoading, resultsLoaded, repository.fullName]);

  useEffect(() => {
    if (resultsLoaded) {
      setResultsLoading(false);
    }
  }, [resultsLoaded]);

  const disabled = !status || !isCompletedAnalysisRepoStatus(status);

  return (
    <div>
      <TitleContainer onClick={toggleExpanded} disabled={disabled} aria-expanded={isExpanded}>
        <VSCodeCheckbox disabled />
        {isExpanded ? <ExpandCollapseCodicon name="chevron-down" label="Collapse" /> :
          <ExpandCollapseCodicon name="chevron-right" label="Expand" />}
        <VSCodeBadge>{resultCount === undefined ? '-' : formatDecimal(resultCount)}</VSCodeBadge>
        <span>{repository.fullName}</span>
        <Visibility isPrivate={repository.private} />
        <span>
          {status === VariantAnalysisRepoStatus.Succeeded && <SuccessIcon />}
          {(status === VariantAnalysisRepoStatus.Failed || status === VariantAnalysisRepoStatus.TimedOut || status === VariantAnalysisRepoStatus.Canceled) &&
            <ErrorIcon label={getErrorLabel(status)} />}
          {status === VariantAnalysisRepoStatus.InProgress && <LoadingIcon label="In progress" />}
          {!status && <WarningIcon />}
        </span>
        {downloadStatus === VariantAnalysisScannedRepositoryDownloadStatus.InProgress && <LoadingIcon label="Downloading" />}
      </TitleContainer>
      {isExpanded && resultsLoaded && status &&
        <AnalyzedRepoItemContent status={status} interpretedResults={interpretedResults} rawResults={rawResults} />}
    </div>
  );
};
