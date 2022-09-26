import * as React from 'react';
import styled from 'styled-components';
import { VSCodeBadge, VSCodePanels, VSCodePanelTab, VSCodePanelView } from '@vscode/webview-ui-toolkit/react';
import { formatDecimal } from '../../pure/number';
import { VariantAnalysis } from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisAnalyzedRepos } from './VariantAnalysisAnalyzedRepos';
import { VariantAnalysisNotFoundRepos } from './VariantAnalysisNotFoundRepos';
import { VariantAnalysisNoCodeqlDbRepos } from './VariantAnalysisNoCodeqlDbRepos';
import { Alert } from '../common';

export type VariantAnalysisOutcomePanelProps = {
  variantAnalysis: VariantAnalysis;
};

const Tab = styled(VSCodePanelTab)`
  text-transform: uppercase;
`;

const WarningsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1em;

  margin-top: 1em;

  > * {
    // Add a margin to the last alert, independent of the number of alerts. This will not add a margin when
    // there is no warning to ensure we do not have a margin-top AND a margin-bottom.
    &:last-child {
      margin-bottom: 1em;
    }
  }
`;

export const VariantAnalysisOutcomePanels = ({
  variantAnalysis
}: VariantAnalysisOutcomePanelProps) => {
  const noCodeqlDbRepositoryCount = variantAnalysis.skippedRepos?.noCodeqlDbRepos?.repositoryCount ?? 0;
  const notFoundRepositoryCount = variantAnalysis.skippedRepos?.notFoundRepos?.repositoryCount ?? 0;
  const overLimitRepositoryCount = variantAnalysis.skippedRepos?.overLimitRepos?.repositoryCount ?? 0;
  const accessMismatchRepositoryCount = variantAnalysis.skippedRepos?.accessMismatchRepos?.repositoryCount ?? 0;

  const warnings = (
    <WarningsContainer>
      {overLimitRepositoryCount > 0 && (
        <Alert
          type="warning"
          title="Repository limit exceeded"
          message={`The number of requested repositories exceeds the maximum number of repositories supported by multi-repository variant analysis. ${overLimitRepositoryCount} ${overLimitRepositoryCount === 1 ? 'repository was' : 'repositories were'} skipped.`}
        />
      )}
      {accessMismatchRepositoryCount > 0 && (
        <Alert
          type="warning"
          title="Access mismatch"
          message={`${accessMismatchRepositoryCount} ${accessMismatchRepositoryCount === 1 ? 'repository is' : 'repositories are'} private, while the controller repository is public. ${accessMismatchRepositoryCount === 1 ? 'This repository was' : 'These repositories were'} skipped.`}
        />
      )}
    </WarningsContainer>
  );

  if (noCodeqlDbRepositoryCount === 0 && notFoundRepositoryCount === 0) {
    return (
      <>
        {warnings}
        <VariantAnalysisAnalyzedRepos />
      </>
    );
  }

  return (
    <>
      {warnings}
      <VSCodePanels>
        <Tab>
          Analyzed
          <VSCodeBadge appearance="secondary">{formatDecimal(variantAnalysis.scannedRepos?.length ?? 0)}</VSCodeBadge>
        </Tab>
        {notFoundRepositoryCount > 0 && (
          <Tab>
            No access
            <VSCodeBadge appearance="secondary">{formatDecimal(notFoundRepositoryCount)}</VSCodeBadge>
          </Tab>
        )}
        {noCodeqlDbRepositoryCount > 0 && (
          <Tab>
            No database
            <VSCodeBadge appearance="secondary">{formatDecimal(noCodeqlDbRepositoryCount)}</VSCodeBadge>
          </Tab>
        )}
        <VSCodePanelView><VariantAnalysisAnalyzedRepos /></VSCodePanelView>
        {notFoundRepositoryCount > 0 && <VSCodePanelView><VariantAnalysisNotFoundRepos /></VSCodePanelView>}
        {noCodeqlDbRepositoryCount > 0 && <VSCodePanelView><VariantAnalysisNoCodeqlDbRepos /></VSCodePanelView>}
      </VSCodePanels>
    </>
  );
};
