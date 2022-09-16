import * as React from 'react';
import styled from 'styled-components';
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';

type Props = {
  completedAt?: Date | undefined;

  onViewLogsClick: () => void;
};

const Icon = styled.span`
  font-size: 1em !important;
  vertical-align: text-bottom;
`;

const ViewLogsLink = styled(VSCodeLink)`
  margin-top: 0.2em;
`;

export const VariantAnalysisCompletionStats = ({
  completedAt,
  onViewLogsClick,
}: Props) => {
  if (completedAt === undefined) {
    return <Icon className="codicon codicon-loading codicon-modifier-spin" />;
  }

  return (
    <>
      {completedAt.toLocaleString()}
      <ViewLogsLink onClick={onViewLogsClick}>View logs</ViewLogsLink>
    </>
  );
};
