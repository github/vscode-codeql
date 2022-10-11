import * as React from 'react';
import styled from 'styled-components';
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import { formatDate } from '../../pure/date';

type Props = {
  completedAt?: Date | undefined;

  onViewLogsClick: () => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
`;

const Icon = styled.span`
  font-size: 1em !important;
  vertical-align: text-bottom;
`;

export const VariantAnalysisStatusStats = ({
  completedAt,
  onViewLogsClick,
}: Props) => {
  if (completedAt === undefined) {
    return <Icon className="codicon codicon-loading codicon-modifier-spin" />;
  }

  return (
    <Container>
      <span>{formatDate(completedAt)}</span>
      <VSCodeLink onClick={onViewLogsClick}>View logs</VSCodeLink>
    </Container>
  );
};
