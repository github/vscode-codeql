import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import {
  VariantAnalysis as VariantAnalysisDomainModel,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisStatus,
} from "../../remote-queries/shared/variant-analysis";
import { VariantAnalysisHeader } from "./VariantAnalysisHeader";
import { VariantAnalysisOutcomePanels } from "./VariantAnalysisOutcomePanels";
import { VariantAnalysisLoading } from "./VariantAnalysisLoading";
import { ToVariantAnalysisMessage } from "../../pure/interface-types";
import { vscode } from "../vscode-api";
import { defaultFilterSortState } from "../../pure/variant-analysis-filter-sort";
import { useTelemetryOnChange } from "../common/telemetry";

export type VariantAnalysisProps = {
  variantAnalysis?: VariantAnalysisDomainModel;
  repoStates?: VariantAnalysisScannedRepositoryState[];
  repoResults?: VariantAnalysisScannedRepositoryResult[];
};

const openQueryFile = () => {
  vscode.postMessage({
    t: "openQueryFile",
  });
};

const openQueryText = () => {
  vscode.postMessage({
    t: "openQueryText",
  });
};

const stopQuery = () => {
  vscode.postMessage({
    t: "cancelVariantAnalysis",
  });
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
}: VariantAnalysisProps): JSX.Element {
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

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToVariantAnalysisMessage = evt.data;
        if (msg.t === "setVariantAnalysis") {
          setVariantAnalysis(msg.variantAnalysis);
          vscode.setState({
            variantAnalysisId: msg.variantAnalysis.id,
          });
        } else if (msg.t === "setRepoResults") {
          setRepoResults((oldRepoResults) => {
            const newRepoIds = msg.repoResults.map((r) => r.repositoryId);
            return [
              ...oldRepoResults.filter(
                (v) => !newRepoIds.includes(v.repositoryId),
              ),
              ...msg.repoResults,
            ];
          });
        } else if (msg.t === "setRepoStates") {
          setRepoStates((oldRepoStates) => {
            const newRepoIds = msg.repoStates.map((r) => r.repositoryId);
            return [
              ...oldRepoStates.filter(
                (v) => !newRepoIds.includes(v.repositoryId),
              ),
              ...msg.repoStates,
            ];
          });
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  const copyRepositoryList = useCallback(() => {
    vscode.postMessage({
      t: "copyRepositoryList",
      filterSort: {
        ...filterSortState,
        repositoryIds: selectedRepositoryIds,
      },
    });
  }, [filterSortState, selectedRepositoryIds]);

  const exportResults = useCallback(() => {
    vscode.postMessage({
      t: "exportResults",
      filterSort: {
        ...filterSortState,
        repositoryIds: selectedRepositoryIds,
      },
    });
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
