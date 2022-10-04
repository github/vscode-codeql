import * as React from 'react';
import styled from 'styled-components';
import { VSCodeBadge, VSCodePanels, VSCodePanelTab, VSCodePanelView } from '@vscode/webview-ui-toolkit/react';
import { formatDecimal } from '../../pure/number';
import { VariantAnalysis, VariantAnalysisScannedRepositoryResult } from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisAnalyzedRepos } from './VariantAnalysisAnalyzedRepos';
import { Alert } from '../common';
import { VariantAnalysisSkippedRepositoriesTab } from './VariantAnalysisSkippedRepositoriesTab';

export type VariantAnalysisOutcomePanelProps = {
  variantAnalysis: VariantAnalysis;
  repositoryResults?: VariantAnalysisScannedRepositoryResult[];
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
  variantAnalysis,
  repositoryResults,
}: VariantAnalysisOutcomePanelProps) => {
  const noCodeqlDbRepos = variantAnalysis.skippedRepos?.noCodeqlDbRepos;
  const notFoundRepos = variantAnalysis.skippedRepos?.notFoundRepos;
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

  if (!noCodeqlDbRepos?.repositoryCount && !notFoundRepos?.repositoryCount) {
    return (
      <>
        {warnings}
        <VariantAnalysisAnalyzedRepos variantAnalysis={variantAnalysis} repositoryResults={repositoryResults} />
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
        {notFoundRepos?.repositoryCount && (
          <Tab>
            No access
            <VSCodeBadge appearance="secondary">{formatDecimal(notFoundRepos.repositoryCount)}</VSCodeBadge>
          </Tab>
        )}
        {noCodeqlDbRepos?.repositoryCount && (
          <Tab>
            No database
            <VSCodeBadge appearance="secondary">{formatDecimal(noCodeqlDbRepos.repositoryCount)}</VSCodeBadge>
          </Tab>
        )}
        <VSCodePanelView><VariantAnalysisAnalyzedRepos variantAnalysis={variantAnalysis} repositoryResults={repositoryResults} /></VSCodePanelView>
        {notFoundRepos?.repositoryCount &&
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle='No access'
              alertMessage='The following repositories could not be scanned because you do not have read access.'
              skippedRepositoryGroup={notFoundRepos} />
          </VSCodePanelView>}
        {noCodeqlDbRepos?.repositoryCount &&
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle='No database'
              alertMessage='The following repositories could not be scanned because they do not have an available CodeQL database.'
              skippedRepositoryGroup={noCodeqlDbRepos} />
          </VSCodePanelView>}
      </VSCodePanels>
    </>
  );
};
