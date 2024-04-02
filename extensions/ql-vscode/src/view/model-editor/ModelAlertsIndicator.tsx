import { styled } from "styled-components";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react";
import { vscode } from "../vscode-api";

const ModelAlertsButton = styled(VSCodeBadge)`
  cursor: pointer;
`;

export type Props = {
  viewState: ModelEditorViewState;
  modeledMethod: ModeledMethod;
  evaluationRun: ModelEvaluationRunState | undefined;
};

export const ModelAlertsIndicator = ({
  viewState,
  modeledMethod,
  evaluationRun,
}: Props) => {
  if (!viewState.showEvaluationUi) {
    return null;
  }

  if (!evaluationRun?.variantAnalysis || !modeledMethod) {
    return null;
  }

  const revealInModelAlertsView = () => {
    vscode.postMessage({
      t: "revealInModelAlertsView",
      modeledMethod,
    });
  };

  // TODO: Once we have alert provenance, we can show actual alert counts here.
  // For now, we show a random number.
  const number = Math.floor(Math.random() * 10);

  return (
    <ModelAlertsButton
      role="button"
      aria-label="Model alerts"
      onClick={(event: React.MouseEvent) => {
        event.stopPropagation();
        revealInModelAlertsView();
      }}
    >
      {number}
    </ModelAlertsButton>
  );
};
