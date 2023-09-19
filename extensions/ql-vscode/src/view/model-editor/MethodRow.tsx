import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeLink,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { styled } from "styled-components";
import { vscode } from "../vscode-api";

import { Method } from "../../model-editor/method";
import {
  ModeledMethod,
  ModeledMethodType,
  Provenance,
} from "../../model-editor/modeled-method";
import { KindInput } from "./KindInput";
import { extensiblePredicateDefinitions } from "../../model-editor/predicates";
import { Mode } from "../../model-editor/shared/mode";
import { Dropdown } from "../common/Dropdown";
import { MethodClassifications } from "./MethodClassifications";
import {
  ModelingStatus,
  ModelingStatusIndicator,
} from "./ModelingStatusIndicator";
import { InProgressDropdown } from "./InProgressDropdown";
import { MethodName } from "./MethodName";

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

const modelTypeOptions: Array<{ value: ModeledMethodType; label: string }> = [
  { value: "none", label: "Unmodeled" },
  { value: "source", label: "Source" },
  { value: "sink", label: "Sink" },
  { value: "summary", label: "Flow summary" },
  { value: "neutral", label: "Neutral" },
];

export type MethodRowProps = {
  method: Method;
  methodCanBeModeled: boolean;
  modeledMethod: ModeledMethod | undefined;
  methodIsUnsaved: boolean;
  modelingInProgress: boolean;
  mode: Mode;
  onChange: (method: Method, modeledMethod: ModeledMethod) => void;
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

  const argumentsList = useMemo(() => {
    if (method.methodParameters === "()") {
      return [];
    }
    return method.methodParameters
      .substring(1, method.methodParameters.length - 1)
      .split(",");
  }, [method.methodParameters]);

  const handleTypeInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      let newProvenance: Provenance = "manual";
      if (modeledMethod?.provenance === "df-generated") {
        newProvenance = "df-manual";
      } else if (modeledMethod?.provenance === "ai-generated") {
        newProvenance = "ai-manual";
      }

      onChange(method, {
        // If there are no arguments, we will default to "Argument[this]"
        input: argumentsList.length === 0 ? "Argument[this]" : "Argument[0]",
        output: "ReturnValue",
        kind: "value",
        ...modeledMethod,
        type: e.target.value as ModeledMethodType,
        provenance: newProvenance,
        signature: method.signature,
        packageName: method.packageName,
        typeName: method.typeName,
        methodName: method.methodName,
        methodParameters: method.methodParameters,
      });
    },
    [onChange, method, modeledMethod, argumentsList],
  );
  const handleInputInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...modeledMethod,
        input: target.value as ModeledMethod["input"],
      });
    },
    [onChange, method, modeledMethod],
  );
  const handleOutputInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...modeledMethod,
        output: target.value as ModeledMethod["output"],
      });
    },
    [onChange, method, modeledMethod],
  );
  const handleKindChange = useCallback(
    (kind: string) => {
      if (!modeledMethod) {
        return;
      }

      onChange(method, {
        ...modeledMethod,
        kind,
      });
    },
    [onChange, method, modeledMethod],
  );

  const jumpToUsage = useCallback(
    () => sendJumpToUsageMessage(method),
    [method],
  );

  const inputOptions = useMemo(
    () => [
      { value: "Argument[this]", label: "Argument[this]" },
      ...argumentsList.map((argument, index) => ({
        value: `Argument[${index}]`,
        label: `Argument[${index}]: ${argument}`,
      })),
    ],
    [argumentsList],
  );

  const outputOptions = useMemo(
    () => [
      { value: "ReturnValue", label: "ReturnValue" },
      { value: "Argument[this]", label: "Argument[this]" },
      ...argumentsList.map((argument, index) => ({
        value: `Argument[${index}]`,
        label: `Argument[${index}]: ${argument}`,
      })),
    ],
    [argumentsList],
  );

  const showInputCell =
    modeledMethod?.type && ["sink", "summary"].includes(modeledMethod?.type);
  const showOutputCell =
    modeledMethod?.type && ["source", "summary"].includes(modeledMethod?.type);
  const predicate =
    modeledMethod?.type && modeledMethod.type !== "none"
      ? extensiblePredicateDefinitions[modeledMethod.type]
      : undefined;
  const showKindCell = predicate?.supportedKinds;

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
            <Dropdown
              value={modeledMethod?.type ?? "none"}
              options={modelTypeOptions}
              onChange={handleTypeInput}
              aria-label="Model type"
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={3}>
            <Dropdown
              value={modeledMethod?.input}
              options={inputOptions}
              disabled={!showInputCell}
              onChange={handleInputInput}
              aria-label="Input"
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={4}>
            <Dropdown
              value={modeledMethod?.output}
              options={outputOptions}
              disabled={!showOutputCell}
              onChange={handleOutputInput}
              aria-label="Output"
            />
          </VSCodeDataGridCell>
          <VSCodeDataGridCell gridColumn={5}>
            <KindInput
              kinds={predicate?.supportedKinds || []}
              value={modeledMethod?.kind}
              disabled={!showKindCell}
              onChange={handleKindChange}
              aria-label="Kind"
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
