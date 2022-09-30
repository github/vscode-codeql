import { VSCodeBadge, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import * as React from 'react';
import styled from 'styled-components';
import { Codicon, WarningIcon } from '../common';
import { VariantAnalysisSkippedRepository as SkippedRepo } from '../../remote-queries/shared/variant-analysis';

export type VariantAnalysisSkippedRepositoryRowProps = {
  repository: SkippedRepo,
};

const Row = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  align-items: center;
`;

const ChevronIcon = styled(Codicon)`
  color: var(--vscode-disabledForeground);
`;

const PrivacyText = styled.span`
  font-size: small;
  color: var(--vscode-descriptionForeground);
`;

function getPrivacyElement(isPrivate: boolean | undefined) {
  if (isPrivate === undefined) {
    return undefined;
  }
  const text = isPrivate ? 'private' : 'public';
  return <PrivacyText>{text}</PrivacyText>;
}

export const VariantAnalysisSkippedRepositoryRow = ({
  repository,
}: VariantAnalysisSkippedRepositoryRowProps) => {
  return (
    <Row>
      <VSCodeCheckbox />
      <ChevronIcon name='chevron-right' label='Expand' />
      <VSCodeBadge>-</VSCodeBadge>
      <span>{repository.fullName}</span>
      {getPrivacyElement(repository.private)}
      <WarningIcon />
    </Row>
  );
};
