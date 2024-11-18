import { useCallback, useState } from "react";

import type {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../../variant-analysis/shared/variant-analysis";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { VariantAnalysisHeader } from "./VariantAnalysisHeader";
import { VariantAnalysisOutcomePanels } from "./VariantAnalysisOutcomePanels";
import { VariantAnalysisLoading } from "./VariantAnalysisLoading";
import type { ToVariantAnalysisMessage } from "../../common/interface-types";
import { vscode } from "../vscode-api";
import { defaultFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { sendTelemetry, useTelemetryOnChange } from "../common/telemetry";
import { useMessageFromExtension } from "../common/useMessageFromExtension";

export type VariantAnalysisProps = {
  variantAnalysis?: VariantAnalysisDomainModel;
  repoStates?: VariantAnalysisScannedRepositoryState[];
  repoResults?: VariantAnalysisScannedRepositoryResult[];
};

const openQueryFile = () => {
  vscode.postMessage({
    t: "openQueryFile",
  });
  sendTelemetry("variant-analysis-open-query-file");
};

const openQueryText = () => {
  vscode.postMessage({
    t: "openQueryText",
  });
  sendTelemetry("variant-analysis-open-query-text");
};

const stopQuery = () => {
  vscode.postMessage({
    t: "cancelVariantAnalysis",
  });
  sendTelemetry("variant-analysis-cancel");
};

const openLogs = () => {
  vscode.postMessage({
    t: "openLogs",
  });
};

export function VariantAnalysis({
  variantAnalysis: initialVariantAnalysis,
  repoStates: initialRepoStates = [],
  repoResults: initialRepoResults = [],
}: VariantAnalysisProps): React.JSX.Element {
  const [variantAnalysis, setVariantAnalysis] = useState<
    VariantAnalysisDomainModel | undefined
  >(initialVariantAnalysis);
  const [repoStates, setRepoStates] =
    useState<VariantAnalysisScannedRepositoryState[]>(initialRepoStates);
  const [repoResults, setRepoResults] =
    useState<VariantAnalysisScannedRepositoryResult[]>(initialRepoResults);

  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<number[]>(
    [],
  );
  useTelemetryOnChange(
    selectedRepositoryIds,
    "variant-analysis-selected-repository-ids",
    {
      debounceTimeoutMillis: 1000,
    },
  );
  const [filterSortState, setFilterSortState] = useState(
    defaultFilterSortState,
  );
  useTelemetryOnChange(filterSortState, "variant-analysis-filter-sort-state", {
    debounceTimeoutMillis: 1000,
  });

  useMessageFromExtension<ToVariantAnalysisMessage>((msg) => {
    if (msg.t === "setVariantAnalysis") {
      setVariantAnalysis(msg.variantAnalysis);
      vscode.setState({
        variantAnalysisId: msg.variantAnalysis.id,
      });
    } else if (msg.t === "setFilterSortState") {
      setFilterSortState(msg.filterSortState);
    } else if (msg.t === "setRepoResults") {
      setRepoResults((oldRepoResults) => {
        const newRepoIds = msg.repoResults.map((r) => r.repositoryId);
        return [
          ...oldRepoResults.filter((v) => !newRepoIds.includes(v.repositoryId)),
          ...msg.repoResults,
        ];
      });
    } else if (msg.t === "setRepoStates") {
      setRepoStates((oldRepoStates) => {
        const newRepoIds = msg.repoStates.map((r) => r.repositoryId);
        return [
          ...oldRepoStates.filter((v) => !newRepoIds.includes(v.repositoryId)),
          ...msg.repoStates,
        ];
      });
    }
  }, []);

  const copyRepositoryList = useCallback(() => {
    vscode.postMessage({
      t: "copyRepositoryList",
      filterSort: {
        ...filterSortState,
        repositoryIds: selectedRepositoryIds,
      },
    });
    sendTelemetry("variant-analysis-copy-repository-list");
  }, [filterSortState, selectedRepositoryIds]);

  const exportResults = useCallback(() => {
    vscode.postMessage({
      t: "exportResults",
      filterSort: {
        ...filterSortState,
        repositoryIds: selectedRepositoryIds,
      },
    });
    sendTelemetry("variant-analysis-export-results");
  }, [filterSortState, selectedRepositoryIds]);

  if (
    variantAnalysis === undefined ||
    (variantAnalysis.status === VariantAnalysisStatus.InProgress &&
      variantAnalysis.actionsWorkflowRunId === undefined)
  ) {
    return <VariantAnalysisLoading />;
  }

  const onViewLogsClick =
    variantAnalysis.actionsWorkflowRunId === undefined ? undefined : openLogs;

  return (
    <>
      <VariantAnalysisHeader
        variantAnalysis={variantAnalysis}
        repositoryStates={repoStates}
        filterSortState={filterSortState}
        selectedRepositoryIds={selectedRepositoryIds}
        onOpenQueryFileClick={openQueryFile}
        onViewQueryTextClick={openQueryText}
        onStopQueryClick={stopQuery}
        onCopyRepositoryListClick={copyRepositoryList}
        onExportResultsClick={exportResults}
        onViewLogsClick={onViewLogsClick}
      />
      <VariantAnalysisOutcomePanels
        variantAnalysis={variantAnalysis}
        repositoryStates={repoStates}
        repositoryResults={repoResults}
        selectedRepositoryIds={selectedRepositoryIds}
        setSelectedRepositoryIds={setSelectedRepositoryIds}
        filterSortState={filterSortState}
        setFilterSortState={setFilterSortState}
      />
    </>
  );
}
