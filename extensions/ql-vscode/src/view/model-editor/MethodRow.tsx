import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeLink,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { useCallback } from "react";
import { styled } from "styled-components";
import { vscode } from "../vscode-api";

import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelKindDropdown } from "./ModelKindDropdown";
import { Mode } from "../../model-editor/shared/mode";
import { MethodClassifications } from "./MethodClassifications";
import {
  ModelingStatus,
  ModelingStatusIndicator,
} from "./ModelingStatusIndicator";
import { InProgressDropdown } from "./InProgressDropdown";
import { MethodName } from "./MethodName";
import { ModelTypeDropdown } from "./ModelTypeDropdown";
import { ModelInputDropdown } from "./ModelInputDropdown";
import { ModelOutputDropdown } from "./ModelOutputDropdown";

const ApiOrMethodCell = styled(VSCodeDataGridCell)`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
`;

const UsagesButton = styled.button`
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-input-background);
  border: none;
  border-radius: 40%;
  cursor: pointer;
`;

const ViewLink = styled(VSCodeLink)`
  white-space: nowrap;
`;

const ProgressRing = styled(VSCodeProgressRing)`
  width: 16px;
  height: 16px;
  margin-left: auto;
`;

export type MethodRowProps = {
  method: Method;
  methodCanBeModeled: boolean;
  modeledMethod: ModeledMethod | undefined;
  methodIsUnsaved: boolean;
  modelingInProgress: boolean;
  mode: Mode;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodRow = (props: MethodRowProps) => {
  const { methodCanBeModeled } = props;

  if (methodCanBeModeled) {
    return <ModelableMethodRow {...props} />;
  } else {
    return <UnmodelableMethodRow {...props} />;
  }
};

function ModelableMethodRow(props: MethodRowProps) {
  const { method, modeledMethod, methodIsUnsaved, mode, onChange } = props;

  const jumpToUsage = useCallback(
    () => sendJumpToUsageMessage(method),
    [method],
  );

  const modelingStatus = getModelingStatus(modeledMethod, methodIsUnsaved);

  return (
    <VSCodeDataGridRow data-testid="modelable-method-row">
      <ApiOrMethodCell gridColumn={1}>
        <ModelingStatusIndicator status={modelingStatus} />
        <MethodClassifications method={method} />
        <MethodName {...props.method} />
        {mode === Mode.Application && (
          <UsagesButton onClick={jumpToUsage}>
            {method.usages.length}
          </UsagesButton>
        )}
        <ViewLink onClick={jumpToUsage}>View</ViewLink>
        {props.modelingInProgress && <ProgressRing />}
      </ApiOrMethodCell>
      {props.modelingInProgress && (
        <>
          <VSCodeDataGridCell gridColumn={2}>
            <InProgressDropdown />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={3}>
            <InProgressDropdown />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={4}>
            <InProgressDropdown />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={5}>
            <InProgressDropdown />
          </VSCodeDataGridCell>
        </>
      )}
      {!props.modelingInProgress && (
        <>
          <VSCodeDataGridCell gridColumn={2}>
            <ModelTypeDropdown
              method={method}
              modeledMethod={modeledMethod}
              onChange={onChange}
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={3}>
            <ModelInputDropdown
              method={method}
              modeledMethod={modeledMethod}
              onChange={onChange}
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={4}>
            <ModelOutputDropdown
              method={method}
              modeledMethod={modeledMethod}
              onChange={onChange}
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={5}>
            <ModelKindDropdown
              method={method}
              modeledMethod={modeledMethod}
              onChange={onChange}
            />
          </VSCodeDataGridCell>
        </>
      )}
    </VSCodeDataGridRow>
  );
}

function UnmodelableMethodRow(props: MethodRowProps) {
  const { method, mode } = props;

  const jumpToUsage = useCallback(
    () => sendJumpToUsageMessage(method),
    [method],
  );

  return (
    <VSCodeDataGridRow data-testid="unmodelable-method-row">
      <ApiOrMethodCell gridColumn={1}>
        <ModelingStatusIndicator status="saved" />
        <MethodName {...props.method} />
        {mode === Mode.Application && (
          <UsagesButton onClick={jumpToUsage}>
            {method.usages.length}
          </UsagesButton>
        )}
        <ViewLink onClick={jumpToUsage}>View</ViewLink>
        <MethodClassifications method={method} />
      </ApiOrMethodCell>
      <VSCodeDataGridCell gridColumn="span 4">
        Method already modeled
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
}

function sendJumpToUsageMessage(method: Method) {
  vscode.postMessage({
    t: "jumpToUsage",
    method,
    // In framework mode, the first and only usage is the definition of the method
    usage: method.usages[0],
  });
}

function getModelingStatus(
  modeledMethod: ModeledMethod | undefined,
  methodIsUnsaved: boolean,
): ModelingStatus {
  if (modeledMethod) {
    if (methodIsUnsaved) {
      return "unsaved";
    } else if (modeledMethod.type !== "none") {
      return "saved";
    }
  }
  return "unmodeled";
}
