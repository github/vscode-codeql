import * as React from 'react';
import { useState } from 'react';
import styled from 'styled-components';
import { VSCodeBadge, VSCodePanels, VSCodePanelTab, VSCodePanelView } from '@vscode/webview-ui-toolkit/react';
import { formatDecimal } from '../../pure/number';
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisStatus
} from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisAnalyzedRepos } from './VariantAnalysisAnalyzedRepos';
import { Alert } from '../common';
import { VariantAnalysisSkippedRepositoriesTab } from './VariantAnalysisSkippedRepositoriesTab';
import { defaultFilterSortState, RepositoriesFilterSortState } from './filterSort';
import { RepositoriesSearchSortRow } from './RepositoriesSearchSortRow';
import { FailureReasonAlert } from './FailureReasonAlert';

export type VariantAnalysisOutcomePanelProps = {
  variantAnalysis: VariantAnalysis;
  repositoryStates?: VariantAnalysisScannedRepositoryState[];
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
  repositoryStates,
  repositoryResults,
}: VariantAnalysisOutcomePanelProps) => {
  const [filterSortState, setFilterSortState] = useState<RepositoriesFilterSortState>(defaultFilterSortState);

  const noCodeqlDbRepos = variantAnalysis.skippedRepos?.noCodeqlDbRepos;
  const notFoundRepos = variantAnalysis.skippedRepos?.notFoundRepos;
  const overLimitRepositoryCount = variantAnalysis.skippedRepos?.overLimitRepos?.repositoryCount ?? 0;
  const accessMismatchRepositoryCount = variantAnalysis.skippedRepos?.accessMismatchRepos?.repositoryCount ?? 0;

  const warnings = (
    <WarningsContainer>
      {variantAnalysis.status === VariantAnalysisStatus.Failed && variantAnalysis.failureReason && (
        <FailureReasonAlert failureReason={variantAnalysis.failureReason} showLogsButton={!!variantAnalysis.actionsWorkflowRunId} />
      )}
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
        <RepositoriesSearchSortRow value={filterSortState} onChange={setFilterSortState} />
        <VariantAnalysisAnalyzedRepos
          variantAnalysis={variantAnalysis}
          repositoryStates={repositoryStates}
          repositoryResults={repositoryResults}
          filterSortState={filterSortState}
        />
      </>
    );
  }

  return (
    <>
      {warnings}
      <RepositoriesSearchSortRow value={filterSortState} onChange={setFilterSortState} />
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
        <VSCodePanelView>
          <VariantAnalysisAnalyzedRepos
            variantAnalysis={variantAnalysis}
            repositoryStates={repositoryStates}
            repositoryResults={repositoryResults}
            filterSortState={filterSortState}
          />
        </VSCodePanelView>
        {notFoundRepos?.repositoryCount &&
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle='No access'
              alertMessage='The following repositories could not be scanned because you do not have read access.'
              skippedRepositoryGroup={notFoundRepos}
              filterSortState={filterSortState}
            />
          </VSCodePanelView>}
        {noCodeqlDbRepos?.repositoryCount &&
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle='No database'
              alertMessage='The following repositories could not be scanned because they do not have an available CodeQL database.'
              skippedRepositoryGroup={noCodeqlDbRepos}
              filterSortState={filterSortState}
            />
          </VSCodePanelView>}
      </VSCodePanels>
    </>
  );
};
