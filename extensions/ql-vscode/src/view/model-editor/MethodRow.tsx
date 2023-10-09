import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeLink,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { forwardRef, useCallback, useEffect, useRef } from "react";
import { styled } from "styled-components";
import { vscode } from "../vscode-api";

import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelKindDropdown } from "./ModelKindDropdown";
import { Mode } from "../../model-editor/shared/mode";
import { MethodClassifications } from "./MethodClassifications";
import { getModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "./ModelingStatusIndicator";
import { InProgressDropdown } from "./InProgressDropdown";
import { MethodName } from "./MethodName";
import { ModelTypeDropdown } from "./ModelTypeDropdown";
import { ModelInputDropdown } from "./ModelInputDropdown";
import { ModelOutputDropdown } from "./ModelOutputDropdown";
import { ModelEditorViewState } from "../../model-editor/shared/view-state";

const MultiModelColumn = styled(VSCodeDataGridCell)`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
`;

const ApiOrMethodRow = styled.div`
  min-height: calc(var(--input-height) * 1px);
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

const DataGridRow = styled(VSCodeDataGridRow)<{ focused?: boolean }>`
  outline: ${(props) =>
    props.focused ? "1px solid var(--vscode-focusBorder)" : "none"};
`;

export type MethodRowProps = {
  method: Method;
  methodCanBeModeled: boolean;
  modeledMethods: ModeledMethod[];
  methodIsUnsaved: boolean;
  modelingInProgress: boolean;
  viewState: ModelEditorViewState;
  revealedMethodSignature: string | null;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodRow = (props: MethodRowProps) => {
  const { method, methodCanBeModeled, revealedMethodSignature } = props;

  const ref = useRef<HTMLElement>();

  useEffect(() => {
    if (method.signature === revealedMethodSignature) {
      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [method, revealedMethodSignature]);

  if (methodCanBeModeled) {
    return <ModelableMethodRow {...props} ref={ref} />;
  } else {
    return <UnmodelableMethodRow {...props} ref={ref} />;
  }
};

const ModelableMethodRow = forwardRef<HTMLElement | undefined, MethodRowProps>(
  (props, ref) => {
    const {
      method,
      modeledMethods: modeledMethodsProp,
      methodIsUnsaved,
      viewState,
      revealedMethodSignature,
      onChange,
    } = props;

    const modeledMethods = viewState.showMultipleModels
      ? modeledMethodsProp
      : modeledMethodsProp.slice(0, 1);

    const jumpToUsage = useCallback(
      () => sendJumpToUsageMessage(method),
      [method],
    );

    const modelingStatus = getModelingStatus(modeledMethods, methodIsUnsaved);

    return (
      <DataGridRow
        data-testid="modelable-method-row"
        ref={ref}
        focused={revealedMethodSignature === method.signature}
      >
        <VSCodeDataGridCell gridColumn={1}>
          <ApiOrMethodRow>
            <ModelingStatusIndicator status={modelingStatus} />
            <MethodClassifications method={method} />
            <MethodName {...props.method} />
            {viewState.mode === Mode.Application && (
              <UsagesButton onClick={jumpToUsage}>
                {method.usages.length}
              </UsagesButton>
            )}
            <ViewLink onClick={jumpToUsage}>View</ViewLink>
            {props.modelingInProgress && <ProgressRing />}
          </ApiOrMethodRow>
        </VSCodeDataGridCell>
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
            <MultiModelColumn gridColumn={2}>
              {forEachModeledMethod(modeledMethods, (modeledMethod, index) => (
                <ModelTypeDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={onChange}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={3}>
              {forEachModeledMethod(modeledMethods, (modeledMethod, index) => (
                <ModelInputDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={onChange}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={4}>
              {forEachModeledMethod(modeledMethods, (modeledMethod, index) => (
                <ModelOutputDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={onChange}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={5}>
              {forEachModeledMethod(modeledMethods, (modeledMethod, index) => (
                <ModelKindDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={onChange}
                />
              ))}
            </MultiModelColumn>
          </>
        )}
      </DataGridRow>
    );
  },
);
ModelableMethodRow.displayName = "ModelableMethodRow";

const UnmodelableMethodRow = forwardRef<
  HTMLElement | undefined,
  MethodRowProps
>((props, ref) => {
  const { method, viewState, revealedMethodSignature } = props;

  const jumpToUsage = useCallback(
    () => sendJumpToUsageMessage(method),
    [method],
  );

  return (
    <DataGridRow
      data-testid="unmodelable-method-row"
      ref={ref}
      focused={revealedMethodSignature === method.signature}
    >
      <VSCodeDataGridCell gridColumn={1}>
        <ApiOrMethodRow>
          <ModelingStatusIndicator status="saved" />
          <MethodName {...props.method} />
          {viewState.mode === Mode.Application && (
            <UsagesButton onClick={jumpToUsage}>
              {method.usages.length}
            </UsagesButton>
          )}
          <ViewLink onClick={jumpToUsage}>View</ViewLink>
          <MethodClassifications method={method} />
        </ApiOrMethodRow>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn="span 4">
        Method already modeled
      </VSCodeDataGridCell>
    </DataGridRow>
  );
});
UnmodelableMethodRow.displayName = "UnmodelableMethodRow";

function sendJumpToUsageMessage(method: Method) {
  vscode.postMessage({
    t: "jumpToUsage",
    method,
    // In framework mode, the first and only usage is the definition of the method
    usage: method.usages[0],
  });
}

function forEachModeledMethod(
  modeledMethods: ModeledMethod[],
  renderer: (
    modeledMethod: ModeledMethod | undefined,
    index: number,
  ) => JSX.Element,
): JSX.Element | JSX.Element[] {
  if (modeledMethods.length === 0) {
    return renderer(undefined, 0);
  } else {
    return modeledMethods.map(renderer);
  }
}
