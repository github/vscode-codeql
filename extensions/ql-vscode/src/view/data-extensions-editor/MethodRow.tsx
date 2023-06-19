import {
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDropdown,
  VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { useCallback, useMemo } from "react";
import styled from "styled-components";
import { vscode } from "../vscode-api";

import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import {
  ModeledMethod,
  ModeledMethodType,
  Provenance,
} from "../../data-extensions-editor/modeled-method";
import { KindInput } from "./KindInput";
import { extensiblePredicateDefinitions } from "../../data-extensions-editor/predicates";

const Dropdown = styled(VSCodeDropdown)`
  width: 100%;
`;

type SupportedUnsupportedSpanProps = {
  supported: boolean;
  modeled: ModeledMethod | undefined;
};

const SupportSpan = styled.span<SupportedUnsupportedSpanProps>`
  color: ${(props) => {
    if (!props.supported && props.modeled && props.modeled?.type !== "none") {
      return "orange";
    } else {
      return props.supported ? "green" : "red";
    }
  }};
`;

const UsagesButton = styled.button`
  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;
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

      let newProvenance: Provenance = "manual";
      if (modeledMethod?.provenance === "df-generated") {
        newProvenance = "df-manual";
      } else if (modeledMethod?.provenance === "ai-generated") {
        newProvenance = "ai-manual";
      }

      onChange(externalApiUsage, {
        // If there are no arguments, we will default to "Argument[this]"
        input: argumentsList.length === 0 ? "Argument[this]" : "Argument[0]",
        output: "ReturnType",
        kind: "value",
        ...modeledMethod,
        type: target.value as ModeledMethodType,
        provenance: newProvenance,
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
  const handleKindChange = useCallback(
    (kind: string) => {
      if (!modeledMethod) {
        return;
      }

      onChange(externalApiUsage, {
        ...modeledMethod,
        kind,
      });
    },
    [onChange, externalApiUsage, modeledMethod],
  );

  const jumpToUsage = useCallback(() => {
    vscode.postMessage({
      t: "jumpToUsage",
      location: externalApiUsage.usages[0].url,
    });
  }, [externalApiUsage]);

  const predicate =
    modeledMethod?.type && modeledMethod.type !== "none"
      ? extensiblePredicateDefinitions[modeledMethod.type]
      : undefined;

  return (
    <VSCodeDataGridRow>
      <VSCodeDataGridCell gridColumn={1}>
        <SupportSpan
          supported={externalApiUsage.supported}
          modeled={modeledMethod}
        >
          {externalApiUsage.packageName}.{externalApiUsage.typeName}
        </SupportSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={2}>
        <SupportSpan
          supported={externalApiUsage.supported}
          modeled={modeledMethod}
        >
          {externalApiUsage.methodName}
          {externalApiUsage.methodParameters}
        </SupportSpan>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={3}>
        <UsagesButton onClick={jumpToUsage}>
          {externalApiUsage.usages.length}
        </UsagesButton>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={4}>
        {(!externalApiUsage.supported ||
          (modeledMethod && modeledMethod?.type !== "none")) && (
          <Dropdown
            value={modeledMethod?.type ?? "none"}
            onInput={handleTypeInput}
          >
            <VSCodeOption value="none">Unmodeled</VSCodeOption>
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
              <VSCodeOption value="Argument[this]">Argument[this]</VSCodeOption>
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
              <VSCodeOption value="Argument[this]">Argument[this]</VSCodeOption>
              {argumentsList.map((argument, index) => (
                <VSCodeOption key={argument} value={`Argument[${index}]`}>
                  Argument[{index}]: {argument}
                </VSCodeOption>
              ))}
            </Dropdown>
          )}
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={7}>
        {predicate?.supportedKinds && (
          <KindInput
            kinds={predicate.supportedKinds}
            value={modeledMethod?.kind}
            onChange={handleKindChange}
          />
        )}
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
};
