import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeLink,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { forwardRef, useCallback, useEffect, useMemo, useRef } from "react";
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
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
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

    const modeledMethods: Array<ModeledMethod | undefined> = useMemo(
      () =>
        modeledMethodsProp.length === 0
          ? [undefined]
          : viewState.showMultipleModels
          ? modeledMethodsProp
          : modeledMethodsProp.slice(0, 1),
      [modeledMethodsProp, viewState],
    );

    const modeledMethodChangedHandlers = useMemo(
      () =>
        modeledMethods.map((_, index) => (modeledMethod: ModeledMethod) => {
          const newModeledMethods = [...modeledMethods];
          newModeledMethods[index] = modeledMethod;
          onChange(
            method.signature,
            newModeledMethods.filter(
              (m): m is ModeledMethod => m !== undefined,
            ),
          );
        }),
      [method, modeledMethods, onChange],
    );

    const jumpToMethod = useCallback(
      () => sendJumpToMethodMessage(method),
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
              <UsagesButton onClick={jumpToMethod}>
                {method.usages.length}
              </UsagesButton>
            )}
            <ViewLink onClick={jumpToMethod}>View</ViewLink>
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
              {modeledMethods.map((modeledMethod, index) => (
                <ModelTypeDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={3}>
              {modeledMethods.map((modeledMethod, index) => (
                <ModelInputDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={4}>
              {modeledMethods.map((modeledMethod, index) => (
                <ModelOutputDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
                />
              ))}
            </MultiModelColumn>
            <MultiModelColumn gridColumn={5}>
              {modeledMethods.map((modeledMethod, index) => (
                <ModelKindDropdown
                  key={index}
                  method={method}
                  modeledMethod={modeledMethod}
                  onChange={modeledMethodChangedHandlers[index]}
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

  const jumpToMethod = useCallback(
    () => sendJumpToMethodMessage(method),
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
            <UsagesButton onClick={jumpToMethod}>
              {method.usages.length}
            </UsagesButton>
          )}
          <ViewLink onClick={jumpToMethod}>View</ViewLink>
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

function sendJumpToMethodMessage(method: Method) {
  vscode.postMessage({
    t: "jumpToMethod",
    methodSignature: method.signature,
  });
}
