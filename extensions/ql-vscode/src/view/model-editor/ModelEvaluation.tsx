import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";
import { modelEvaluationRunIsRunning } from "../../model-editor/shared/model-evaluation-run-state";
import { ModelEditorProgressRing } from "./ModelEditorProgressRing";

export const ModelEvaluation = ({
  viewState,
  modeledMethods,
  modifiedSignatures,
  onStartEvaluation,
  onStopEvaluation,
  evaluationRun,
}: {
  viewState: ModelEditorViewState;
  modeledMethods: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  onStartEvaluation: () => void;
  onStopEvaluation: () => void;
  evaluationRun: ModelEvaluationRunState | undefined;
}) => {
  if (!viewState.showEvaluationUi) {
    return null;
  }

  if (!evaluationRun || !modelEvaluationRunIsRunning(evaluationRun)) {
    const customModelsExist = Object.values(modeledMethods).some(
      (methods) => methods.filter((m) => m.type !== "none").length > 0,
    );

    const unsavedChanges = modifiedSignatures.size > 0;

    return (
      <VSCodeButton
        onClick={onStartEvaluation}
        appearance="secondary"
        disabled={!customModelsExist || unsavedChanges}
      >
        Evaluate
      </VSCodeButton>
    );
  } else {
    return (
      <VSCodeButton onClick={onStopEvaluation} appearance="secondary">
        <ModelEditorProgressRing />
        Stop evaluation
      </VSCodeButton>
    );
  }
};
