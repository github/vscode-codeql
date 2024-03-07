import { styled } from "styled-components";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";

const ModelAlertsButton = styled.button`
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-input-background);
  border: none;
  border-radius: 40%;
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

  if (!evaluationRun || !modeledMethod) {
    return null;
  }

  // TODO: Once we have alert provenance, we can show actual alert counts here.
  // For now, we show a random number.
  const number = Math.floor(Math.random() * 10);

  return (
    <ModelAlertsButton
      onClick={(event: React.MouseEvent) => {
        event.stopPropagation();
      }}
    >
      {number}
    </ModelAlertsButton>
  );
};
