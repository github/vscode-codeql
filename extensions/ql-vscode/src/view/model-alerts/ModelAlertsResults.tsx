import { styled } from "styled-components";
import type { ModelAlerts } from "../../model-editor/model-alerts/model-alerts";
import { Codicon } from "../common";
import { useCallback, useState } from "react";
import { VSCodeBadge, VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import { formatDecimal } from "../../common/number";
import AnalysisAlertResult from "../variant-analysis/AnalysisAlertResult";
import { MethodName } from "../model-editor/MethodName";
import { ModelDetails } from "./ModelDetails";
import { vscode } from "../vscode-api";
import type { ModeledMethod } from "../../model-editor/modeled-method";

// This will ensure that these icons have a className which we can use in the TitleContainer
const ExpandCollapseCodicon = styled(Codicon)``;

const TitleContainer = styled.button`
  display: flex;
  gap: 0.5em;
  align-items: center;
  width: 100%;

  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;

  &:disabled {
    cursor: default;

    ${ExpandCollapseCodicon} {
      color: var(--vscode-disabledForeground);
    }
  }
`;

const ModelTypeText = styled.span`
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
`;

const ViewLink = styled(VSCodeLink)`
  white-space: nowrap;
  padding: 0 0 0.25em 1em;
`;

const ModelDetailsContainer = styled.div`
  padding-top: 10px;
`;

const AlertsContainer = styled.ul`
  list-style-type: none;
  margin: 1em 0 0;
  padding: 0.5em 0 0 0;
`;

const Alert = styled.li`
  margin-bottom: 1em;
  background-color: var(--vscode-notifications-background);
`;

interface Props {
  modelAlerts: ModelAlerts;
}

export const ModelAlertsResults = ({
  modelAlerts,
}: Props): React.JSX.Element => {
  const [isExpanded, setExpanded] = useState(true);
  const viewInModelEditor = useCallback(
    () => sendRevealInModelEditorMessage(modelAlerts.model),
    [modelAlerts.model],
  );
  return (
    <div>
      <TitleContainer onClick={() => setExpanded(!isExpanded)}>
        {isExpanded && (
          <ExpandCollapseCodicon name="chevron-down" label="Collapse" />
        )}
        {!isExpanded && (
          <ExpandCollapseCodicon name="chevron-right" label="Expand" />
        )}
        <VSCodeBadge>{formatDecimal(modelAlerts.alerts.length)}</VSCodeBadge>
        <MethodName {...modelAlerts.model}></MethodName>
        <ModelTypeText>{modelAlerts.model.type}</ModelTypeText>
        <ViewLink onClick={viewInModelEditor}>View</ViewLink>
      </TitleContainer>
      {isExpanded && (
        <>
          <ModelDetailsContainer>
            <ModelDetails model={modelAlerts.model} />
          </ModelDetailsContainer>
          <AlertsContainer>
            {modelAlerts.alerts.map((r, i) => (
              <Alert key={i}>
                <AnalysisAlertResult alert={r.alert} />
              </Alert>
            ))}
          </AlertsContainer>
        </>
      )}
    </div>
  );
};

function sendRevealInModelEditorMessage(modeledMethod: ModeledMethod) {
  vscode.postMessage({
    t: "revealInModelEditor",
    method: modeledMethod,
  });
}
