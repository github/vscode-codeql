import { styled } from "styled-components";
import type { ModelAlerts } from "../../model-editor/model-alerts/model-alerts";
import { Codicon } from "../common";
import { useState } from "react";
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react";
import { formatDecimal } from "../../common/number";
import AnalysisAlertResult from "../variant-analysis/AnalysisAlertResult";
import { MethodName } from "../model-editor/MethodName";
import { ModelDetails } from "./ModelDetails";

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
