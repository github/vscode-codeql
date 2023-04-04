import {
  ExternalApiUsage,
  ModeledMethod,
} from "../../data-extensions-editor/interface";
import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { useCallback, useMemo } from "react";
import styled from "styled-components";
import { vscode } from "../vscode-api";

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
`;

const TextField = styled(VSCodeTextField)`
  width: 100%;
`;

type SupportedUnsupportedSpanProps = {
  supported: boolean;
};

const SupportedUnsupportedSpan = styled.span<SupportedUnsupportedSpanProps>`
  color: ${(props) => (props.supported ? "green" : "red")};
`;

const UsagesButton = styled.button`
  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;
`;

type Props = {
  method: ExternalApiUsage;
  model: ModeledMethod | undefined;
  onChange: (method: ExternalApiUsage, model: ModeledMethod) => void;
};

export const MethodRow = ({ method, model, onChange }: Props) => {
  const argumentsList = useMemo(() => {
    if (method.methodParameters === "()") {
      return [];
    }
    return method.methodParameters
      .substring(1, method.methodParameters.length - 1)
      .split(",");
  }, [method.methodParameters]);

  const handleTypeInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(method, {
        input: argumentsList.length === 0 ? "Argument[-1]" : "Argument[0]",
        output: "ReturnType",
        kind: "value",
        ...model,
        type: target.value as ModeledMethod["type"],
      });
    },
    [onChange, method, model, argumentsList],
  );
  const handleInputInput = useCallback(
    (e: InputEvent) => {
      if (!model) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...model,
        input: target.value as ModeledMethod["input"],
      });
    },
    [onChange, method, model],
  );
  const handleOutputInput = useCallback(
    (e: InputEvent) => {
      if (!model) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...model,
        output: target.value as ModeledMethod["output"],
      });
    },
    [onChange, method, model],
  );
  const handleKindInput = useCallback(
    (e: InputEvent) => {
      if (!model) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...model,
        kind: target.value as ModeledMethod["kind"],
      });
    },
    [onChange, method, model],
  );

  const jumpToUsage = useCallback(() => {
    vscode.postMessage({
      t: "jumpToUsage",
      location: method.usages[0].url,
    });
  }, [method]);

  return (
    <VSCodeDataGridRow>
      <VSCodeDataGridCell gridColumn={1}>
        <SupportedUnsupportedSpan supported={method.supported}>
          {method.packageName}.{method.typeName}
        </SupportedUnsupportedSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={2}>
        <SupportedUnsupportedSpan supported={method.supported}>
          {method.methodName}
          {method.methodParameters}
        </SupportedUnsupportedSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={3}>
        <UsagesButton onClick={jumpToUsage}>
          {method.usages.length}
        </UsagesButton>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={4}>
        {(!method.supported || (model && model?.type !== "none")) && (
          <Dropdown value={model?.type ?? "none"} onInput={handleTypeInput}>
            <VSCodeOption value="none">Unmodelled</VSCodeOption>
            <VSCodeOption value="source">Source</VSCodeOption>
            <VSCodeOption value="sink">Sink</VSCodeOption>
            <VSCodeOption value="summary">Flow summary</VSCodeOption>
            <VSCodeOption value="neutral">Neutral</VSCodeOption>
          </Dropdown>
        )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={5}>
        {model?.type && ["sink", "summary"].includes(model?.type) && (
          <Dropdown value={model?.input} onInput={handleInputInput}>
            <VSCodeOption value="Argument[-1]">Argument[-1]: this</VSCodeOption>
            {argumentsList.map((argument, index) => (
              <VSCodeOption key={argument} value={`Argument[${index}]`}>
                Argument[{index}]: {argument}
              </VSCodeOption>
            ))}
          </Dropdown>
        )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={6}>
        {model?.type && ["source", "summary"].includes(model?.type) && (
          <Dropdown value={model?.output} onInput={handleOutputInput}>
            <VSCodeOption value="ReturnValue">ReturnValue</VSCodeOption>
            <VSCodeOption value="Argument[-1]">Argument[-1]: this</VSCodeOption>
            {argumentsList.map((argument, index) => (
              <VSCodeOption key={argument} value={`Argument[${index}]`}>
                Argument[{index}]: {argument}
              </VSCodeOption>
            ))}
          </Dropdown>
        )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={7}>
        {model?.type && ["source", "sink", "summary"].includes(model?.type) && (
          <TextField value={model?.kind} onInput={handleKindInput} />
        )}
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
};
