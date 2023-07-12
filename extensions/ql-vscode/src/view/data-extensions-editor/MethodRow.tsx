import {
  VSCodeCheckbox,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeLink,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
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
import { Mode } from "../../data-extensions-editor/shared/mode";
import { Dropdown } from "../common/Dropdown";

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

type Props = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod: ModeledMethod | undefined;
  mode: Mode;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const MethodRow = ({
  externalApiUsage,
  modeledMethod,
  mode,
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
    (e: ChangeEvent<HTMLSelectElement>) => {
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
        type: e.target.value as ModeledMethodType,
        provenance: newProvenance,
      });
    },
    [onChange, externalApiUsage, modeledMethod, argumentsList],
  );
  const handleInputInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
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
    (e: ChangeEvent<HTMLSelectElement>) => {
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
      // In framework mode, the first and only usage is the definition of the method
      location: externalApiUsage.usages[0].url,
    });
  }, [externalApiUsage]);

  const methodCanBeModeled =
    !externalApiUsage.supported ||
    (modeledMethod && modeledMethod?.type !== "none");
  const modelTypeOptions = useMemo(
    () => [
      { value: "none", label: "Unmodeled" },
      { value: "source", label: "Source" },
      { value: "sink", label: "Sink" },
      { value: "summary", label: "Flow summary" },
      { value: "neutral", label: "Neutral" },
    ],
    [],
  );

  const showInputCell =
    modeledMethod?.type && ["sink", "summary"].includes(modeledMethod?.type);
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

  const showOutputCell =
    modeledMethod?.type && ["source", "summary"].includes(modeledMethod?.type);
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

  const predicate =
    modeledMethod?.type && modeledMethod.type !== "none"
      ? extensiblePredicateDefinitions[modeledMethod.type]
      : undefined;
  const showKindCell = predicate?.supportedKinds;

  return (
    <VSCodeDataGridRow>
      <ApiOrMethodCell gridColumn={1}>
        <VSCodeCheckbox />
        <span>
          {externalApiUsage.packageName}.{externalApiUsage.typeName}.
          {externalApiUsage.methodName}
          {externalApiUsage.methodParameters}
        </span>
        {mode === Mode.Application && (
          <UsagesButton onClick={jumpToUsage}>
            {externalApiUsage.usages.length}
          </UsagesButton>
        )}
        <ViewLink onClick={jumpToUsage}>View</ViewLink>
      </ApiOrMethodCell>
      <VSCodeDataGridCell gridColumn={2}>
        <Dropdown
          value={modeledMethod?.type ?? "none"}
          options={modelTypeOptions}
          disabled={!methodCanBeModeled}
          onChange={handleTypeInput}
        />
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={3}>
        <Dropdown
          value={modeledMethod?.input}
          options={inputOptions}
          disabled={!showInputCell}
          onChange={handleInputInput}
        />
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={4}>
        <Dropdown
          value={modeledMethod?.output}
          options={outputOptions}
          disabled={!showOutputCell}
          onChange={handleOutputInput}
        />
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={5}>
        <KindInput
          kinds={predicate?.supportedKinds || []}
          value={modeledMethod?.kind}
          disabled={!showKindCell}
          onChange={handleKindChange}
        />
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
};
