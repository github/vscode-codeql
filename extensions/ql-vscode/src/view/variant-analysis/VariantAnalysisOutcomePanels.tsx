import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { styled } from "styled-components";
import {
  VSCodeBadge,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
} from "@vscode/webview-ui-toolkit/react";
import { formatDecimal } from "../../common/number";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../../variant-analysis/shared/variant-analysis";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { VariantAnalysisAnalyzedRepos } from "./VariantAnalysisAnalyzedRepos";
import { Alert } from "../common";
import { VariantAnalysisSkippedRepositoriesTab } from "./VariantAnalysisSkippedRepositoriesTab";
import type { RepositoriesFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { RepositoriesSearchSortRow } from "./RepositoriesSearchSortRow";
import { FailureReasonAlert } from "./FailureReasonAlert";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

export type VariantAnalysisOutcomePanelProps = {
  variantAnalysis: VariantAnalysis;
  repositoryStates?: VariantAnalysisScannedRepositoryState[];
  repositoryResults?: VariantAnalysisScannedRepositoryResult[];

  selectedRepositoryIds?: number[];
  setSelectedRepositoryIds?: Dispatch<SetStateAction<number[]>>;

  filterSortState: RepositoriesFilterSortState;
  setFilterSortState: Dispatch<SetStateAction<RepositoriesFilterSortState>>;
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
  selectedRepositoryIds,
  setSelectedRepositoryIds,
  filterSortState,
  setFilterSortState,
}: VariantAnalysisOutcomePanelProps) => {
  const scannedReposCount = variantAnalysis.scannedRepos?.length ?? 0;
  const noCodeqlDbRepos = variantAnalysis.skippedRepos?.noCodeqlDbRepos;
  const notFoundRepos = variantAnalysis.skippedRepos?.notFoundRepos;
  const overLimitRepositoryCount =
    variantAnalysis.skippedRepos?.overLimitRepos?.repositoryCount ?? 0;
  const accessMismatchRepositoryCount =
    variantAnalysis.skippedRepos?.accessMismatchRepos?.repositoryCount ?? 0;

  const [resultFormat, setResultFormat] = useState(ResultFormat.Alerts);
  const warnings = (
    <WarningsContainer>
      {variantAnalysis.status === VariantAnalysisStatus.Canceled && (
        <Alert
          type="warning"
          title="Variant analysis canceled"
          message="Variant analysis canceled before all queries were complete. Some repositories were not analyzed."
        />
      )}
      {variantAnalysis.status === VariantAnalysisStatus.Failed &&
        variantAnalysis.failureReason && (
          <FailureReasonAlert failureReason={variantAnalysis.failureReason} />
        )}
      {overLimitRepositoryCount > 0 && (
        <Alert
          type="warning"
          title="Repository list too large"
          message={`Repository list contains more than ${formatDecimal(
            scannedReposCount,
          )} entries. Only the first ${formatDecimal(
            scannedReposCount,
          )} repositories were processed.`}
        />
      )}
      {accessMismatchRepositoryCount > 0 && (
        <Alert
          type="warning"
          title="Problem with controller repository"
          message={`Publicly visible controller repository can't be used to analyze private repositories. ${formatDecimal(
            accessMismatchRepositoryCount,
          )} ${
            accessMismatchRepositoryCount === 1
              ? "private repository was"
              : "private repositories were"
          } not analyzed.`}
        />
      )}
    </WarningsContainer>
  );

  const noPanels =
    scannedReposCount === 0 &&
    !noCodeqlDbRepos?.repositoryCount &&
    !notFoundRepos?.repositoryCount;
  if (noPanels) {
    return warnings;
  }

  if (!noCodeqlDbRepos?.repositoryCount && !notFoundRepos?.repositoryCount) {
    return (
      <>
        {warnings}
        <RepositoriesSearchSortRow
          filterSortValue={filterSortState}
          resultFormatValue={resultFormat}
          onFilterSortChange={setFilterSortState}
          onResultFormatChange={setResultFormat}
          variantAnalysisQueryKind={variantAnalysis.query.kind}
        />
        <VariantAnalysisAnalyzedRepos
          variantAnalysis={variantAnalysis}
          repositoryStates={repositoryStates}
          repositoryResults={repositoryResults}
          filterSortState={filterSortState}
          resultFormat={resultFormat}
          selectedRepositoryIds={selectedRepositoryIds}
          setSelectedRepositoryIds={setSelectedRepositoryIds}
        />
      </>
    );
  }

  return (
    <>
      {warnings}
      <RepositoriesSearchSortRow
        filterSortValue={filterSortState}
        resultFormatValue={resultFormat}
        onFilterSortChange={setFilterSortState}
        onResultFormatChange={setResultFormat}
        variantAnalysisQueryKind={variantAnalysis.query.kind}
      />
      <VSCodePanels>
        {scannedReposCount > 0 && (
          <Tab>
            Analyzed
            <VSCodeBadge appearance="secondary">
              {formatDecimal(variantAnalysis.scannedRepos?.length ?? 0)}
            </VSCodeBadge>
          </Tab>
        )}
        {notFoundRepos?.repositoryCount && (
          <Tab>
            No access
            <VSCodeBadge appearance="secondary">
              {formatDecimal(notFoundRepos.repositoryCount)}
            </VSCodeBadge>
          </Tab>
        )}
        {noCodeqlDbRepos?.repositoryCount && (
          <Tab>
            No database
            <VSCodeBadge appearance="secondary">
              {formatDecimal(noCodeqlDbRepos.repositoryCount)}
            </VSCodeBadge>
          </Tab>
        )}
        {scannedReposCount > 0 && (
          <VSCodePanelView>
            <VariantAnalysisAnalyzedRepos
              variantAnalysis={variantAnalysis}
              repositoryStates={repositoryStates}
              repositoryResults={repositoryResults}
              filterSortState={filterSortState}
              resultFormat={resultFormat}
              selectedRepositoryIds={selectedRepositoryIds}
              setSelectedRepositoryIds={setSelectedRepositoryIds}
            />
          </VSCodePanelView>
        )}
        {notFoundRepos?.repositoryCount && (
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle="No access"
              alertMessage="The following repositories can't be analyzed because they don’t exist or you don’t have access."
              skippedRepositoryGroup={notFoundRepos}
              filterSortState={filterSortState}
            />
          </VSCodePanelView>
        )}
        {noCodeqlDbRepos?.repositoryCount && (
          <VSCodePanelView>
            <VariantAnalysisSkippedRepositoriesTab
              alertTitle="No CodeQL database"
              alertMessage="The following repositories can't be analyzed because they don't currently have a CodeQL database available for the selected language."
              skippedRepositoryGroup={noCodeqlDbRepos}
              filterSortState={filterSortState}
            />
          </VSCodePanelView>
        )}
      </VSCodePanels>
    </>
  );
};
