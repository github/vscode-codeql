import { styled } from "styled-components";
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";
import { modelEvaluationRunIsRunning } from "../../model-editor/shared/model-evaluation-run-state";
import { ModelEditorProgressRing } from "./ModelEditorProgressRing";
import { LinkIconButton } from "../common/LinkIconButton";

export type Props = {
  viewState: ModelEditorViewState;
  modeledMethods: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  onStartEvaluation: () => void;
  onStopEvaluation: () => void;
  openModelAlertsView: () => void;
  evaluationRun: ModelEvaluationRunState | undefined;
};

const RunLink = styled(VSCodeLink)`
  display: flex;
  align-items: center;
`;

export const ModelEvaluation = ({
  viewState,
  modeledMethods,
  modifiedSignatures,
  onStartEvaluation,
  onStopEvaluation,
  openModelAlertsView,
  evaluationRun,
}: Props) => {
  if (!viewState.showEvaluationUi) {
    return null;
  }

  const shouldShowEvaluateButton =
    !evaluationRun || !modelEvaluationRunIsRunning(evaluationRun);

  const shouldShowStopButton = !shouldShowEvaluateButton;

  const shouldShowEvaluationRunLink =
    !!evaluationRun && evaluationRun.variantAnalysis;

  const customModelsExist = Object.values(modeledMethods).some(
    (methods) => methods.filter((m) => m.type !== "none").length > 0,
  );

  const unsavedChanges = modifiedSignatures.size > 0;

  return (
    <>
      {shouldShowEvaluateButton && (
        <VSCodeButton
          onClick={onStartEvaluation}
          appearance="secondary"
          disabled={!customModelsExist || unsavedChanges}
        >
          Evaluate
        </VSCodeButton>
      )}
      {shouldShowStopButton && (
        <VSCodeButton onClick={onStopEvaluation} appearance="secondary">
          <ModelEditorProgressRing />
          Stop evaluation
        </VSCodeButton>
      )}
      {shouldShowEvaluationRunLink && (
        <RunLink>
          <LinkIconButton onClick={openModelAlertsView}>
            <span slot="end" className="codicon codicon-link-external"></span>
            Evaluation run
          </LinkIconButton>
        </RunLink>
      )}
    </>
  );
};
