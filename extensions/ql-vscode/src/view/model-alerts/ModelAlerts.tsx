import { useCallback, useEffect, useState } from "react";
import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import type { ToModelAlertsMessage } from "../../common/interface-types";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../../variant-analysis/shared/variant-analysis";
import { vscode } from "../vscode-api";
import { ModelAlertsHeader } from "./ModelAlertsHeader";

type Props = {
  initialViewState?: ModelAlertsViewState;
};

export function ModelAlerts({ initialViewState }: Props): React.JSX.Element {
  const onOpenModelPackClick = useCallback((path: string) => {
    vscode.postMessage({
      t: "openModelPack",
      path,
    });
  }, []);

  const onStopRunClick = useCallback(() => {
    vscode.postMessage({
      t: "stopEvaluationRun",
    });
  }, []);

  const [viewState, setViewState] = useState<ModelAlertsViewState | undefined>(
    initialViewState,
  );

  const [variantAnalysis, setVariantAnalysis] = useState<
    VariantAnalysis | undefined
  >(undefined);
  const [repoStates, setRepoStates] = useState<
    VariantAnalysisScannedRepositoryState[]
  >([]);
  const [repoResults, setRepoResults] = useState<
    VariantAnalysisScannedRepositoryResult[]
  >([]);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToModelAlertsMessage = evt.data;
        switch (msg.t) {
          case "setModelAlertsViewState": {
            setViewState(msg.viewState);
            break;
          }
          case "setVariantAnalysis": {
            setVariantAnalysis(msg.variantAnalysis);
            break;
          }
          case "setRepoStates": {
            setRepoStates((oldRepoStates) => {
              const newRepoIds = msg.repoStates.map((r) => r.repositoryId);
              return [
                ...oldRepoStates.filter(
                  (v) => !newRepoIds.includes(v.repositoryId),
                ),
                ...msg.repoStates,
              ];
            });
            break;
          }
          case "setRepoResults": {
            setRepoResults((oldRepoResults) => {
              const newRepoIds = msg.repoResults.map((r) => r.repositoryId);
              return [
                ...oldRepoResults.filter(
                  (v) => !newRepoIds.includes(v.repositoryId),
                ),
                ...msg.repoResults,
              ];
            });
            break;
          }
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

  if (viewState === undefined || variantAnalysis === undefined) {
    return <></>;
  }

  const openLogs = () => {
    vscode.postMessage({
      t: "openActionsLogs",
      variantAnalysisId: variantAnalysis.id,
    });
  };

  const onViewLogsClick =
    variantAnalysis.actionsWorkflowRunId === undefined ? undefined : openLogs;

  return (
    <>
      <ModelAlertsHeader
        viewState={viewState}
        variantAnalysis={variantAnalysis}
        openModelPackClick={onOpenModelPackClick}
        onViewLogsClick={onViewLogsClick}
        stopRunClick={onStopRunClick}
      ></ModelAlertsHeader>
      <div>
        <h3>Repo states</h3>
        <p>{JSON.stringify(repoStates, null, 2)}</p>
      </div>
      <div>
        <h3>Repo results</h3>
        <p>{JSON.stringify(repoResults, null, 2)}</p>
      </div>
    </>
  );
}
