import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisStatus } from '../../remote-queries/shared/variant-analysis';
import { formatDecimal } from '../../pure/number';

type Props = {
  variantAnalysisStatus: VariantAnalysisStatus;

  totalRepositoryCount: number;
  completedRepositoryCount?: number | undefined;

  queryResult?: 'warning' | 'stopped';
};

const Icon = styled.span`
  vertical-align: text-bottom;
  margin-left: 0.3em;
`;

const WarningIcon = styled(Icon)`
  color: var(--vscode-problemsWarningIcon-foreground);
`;

const ErrorIcon = styled(Icon)`
  color: var(--vscode-problemsErrorIcon-foreground);
`;

const SuccessIcon = styled(Icon)`
  color: var(--vscode-testing-iconPassed);
`;

export const VariantAnalysisRepositoriesStats = ({
  variantAnalysisStatus,
  totalRepositoryCount,
  completedRepositoryCount = 0,
  queryResult,
}: Props) => {
  if (variantAnalysisStatus === VariantAnalysisStatus.Failed) {
    return (
      <>
        0<ErrorIcon role="img" aria-label="Error" className="codicon codicon-error" />
      </>
    );
  }

  return (
    <>
      {formatDecimal(completedRepositoryCount)}/{formatDecimal(totalRepositoryCount)}
      {queryResult && <WarningIcon role="img" aria-label="Warning" className="codicon codicon-warning" />}
      {!queryResult && variantAnalysisStatus === VariantAnalysisStatus.Succeeded &&
        <SuccessIcon role="img" aria-label="Completed" className="codicon codicon-pass" />}
    </>
  );
};
