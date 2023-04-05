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

import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";

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

type Props = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod: ModeledMethod | undefined;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const MethodRow = ({
  externalApiUsage,
  modeledMethod,
  onChange,
}: Props) => {
  const argumentsList = useMemo(() => {
    if (externalApiUsage.methodParameters === "()") {
      return [];
    }
    return externalApiUsage.methodParameters
      .substring(1, externalApiUsage.methodParameters.length - 1)
      .split(",");
  }, [externalApiUsage.methodParameters]);

  const handleTypeInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLSelectElement;

      onChange(externalApiUsage, {
        input: argumentsList.length === 0 ? "Argument[-1]" : "Argument[0]",
        output: "ReturnType",
        kind: "value",
        ...modeledMethod,
        type: target.value as ModeledMethod["type"],
      });
    },
    [onChange, externalApiUsage, modeledMethod, argumentsList],
  );
  const handleInputInput = useCallback(
    (e: InputEvent) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(externalApiUsage, {
        ...modeledMethod,
        input: target.value as ModeledMethod["input"],
      });
    },
    [onChange, externalApiUsage, modeledMethod],
  );
  const handleOutputInput = useCallback(
    (e: InputEvent) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(externalApiUsage, {
        ...modeledMethod,
        output: target.value as ModeledMethod["output"],
      });
    },
    [onChange, externalApiUsage, modeledMethod],
  );
  const handleKindInput = useCallback(
    (e: InputEvent) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(externalApiUsage, {
        ...modeledMethod,
        kind: target.value as ModeledMethod["kind"],
      });
    },
    [onChange, externalApiUsage, modeledMethod],
  );

  return (
    <VSCodeDataGridRow>
      <VSCodeDataGridCell gridColumn={1}>
        <SupportedUnsupportedSpan supported={externalApiUsage.supported}>
          {externalApiUsage.packageName}.{externalApiUsage.typeName}
        </SupportedUnsupportedSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={2}>
        <SupportedUnsupportedSpan supported={externalApiUsage.supported}>
          {externalApiUsage.methodName}
          {externalApiUsage.methodParameters}
        </SupportedUnsupportedSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={3}>
        {externalApiUsage.usages.length}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={4}>
        {(!externalApiUsage.supported ||
          (modeledMethod && modeledMethod?.type !== "none")) && (
          <Dropdown
            value={modeledMethod?.type ?? "none"}
            onInput={handleTypeInput}
          >
            <VSCodeOption value="none">Unmodelled</VSCodeOption>
            <VSCodeOption value="source">Source</VSCodeOption>
            <VSCodeOption value="sink">Sink</VSCodeOption>
            <VSCodeOption value="summary">Flow summary</VSCodeOption>
            <VSCodeOption value="neutral">Neutral</VSCodeOption>
          </Dropdown>
        )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={5}>
        {modeledMethod?.type &&
          ["sink", "summary"].includes(modeledMethod?.type) && (
            <Dropdown value={modeledMethod?.input} onInput={handleInputInput}>
              <VSCodeOption value="Argument[-1]">
                Argument[-1]: this
              </VSCodeOption>
              {argumentsList.map((argument, index) => (
                <VSCodeOption key={argument} value={`Argument[${index}]`}>
                  Argument[{index}]: {argument}
                </VSCodeOption>
              ))}
            </Dropdown>
          )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={6}>
        {modeledMethod?.type &&
          ["source", "summary"].includes(modeledMethod?.type) && (
            <Dropdown value={modeledMethod?.output} onInput={handleOutputInput}>
              <VSCodeOption value="ReturnValue">ReturnValue</VSCodeOption>
              <VSCodeOption value="Argument[-1]">
                Argument[-1]: this
              </VSCodeOption>
              {argumentsList.map((argument, index) => (
                <VSCodeOption key={argument} value={`Argument[${index}]`}>
                  Argument[{index}]: {argument}
                </VSCodeOption>
              ))}
            </Dropdown>
          )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={7}>
        {modeledMethod?.type &&
          ["source", "sink", "summary"].includes(modeledMethod?.type) && (
            <TextField value={modeledMethod?.kind} onInput={handleKindInput} />
          )}
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
};
