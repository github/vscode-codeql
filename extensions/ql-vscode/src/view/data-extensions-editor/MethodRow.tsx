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

  const predicate =
    modeledMethod?.type && modeledMethod.type !== "none"
      ? extensiblePredicateDefinitions[modeledMethod.type]
      : undefined;

  const showModelTypeCell =
    !externalApiUsage.supported ||
    (modeledMethod && modeledMethod?.type !== "none");
  const showInputCell =
    modeledMethod?.type && ["sink", "summary"].includes(modeledMethod?.type);
  const showOutputCell =
    modeledMethod?.type && ["source", "summary"].includes(modeledMethod?.type);
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
        <VSCodeLink onClick={jumpToUsage}>View</VSCodeLink>
      </ApiOrMethodCell>
      <VSCodeDataGridCell gridColumn={2}>
        <Dropdown
          value={showModelTypeCell ? modeledMethod?.type ?? "none" : undefined}
          disabled={!showModelTypeCell}
          onChange={handleTypeInput}
        >
          {showModelTypeCell && (
            <>
              <option value="none">Unmodeled</option>
              <option value="source">Source</option>
              <option value="sink">Sink</option>
              <option value="summary">Flow summary</option>
              <option value="neutral">Neutral</option>
            </>
          )}
        </Dropdown>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={3}>
        <Dropdown
          value={showInputCell ? modeledMethod?.input : undefined}
          disabled={!showInputCell}
          onChange={handleInputInput}
        >
          {showInputCell && (
            <>
              <option value="Argument[this]">Argument[this]</option>
              {argumentsList.map((argument, index) => (
                <option key={argument} value={`Argument[${index}]`}>
                  Argument[{index}]: {argument}
                </option>
              ))}
            </>
          )}
        </Dropdown>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={4}>
        <Dropdown
          value={showOutputCell ? modeledMethod?.output : undefined}
          disabled={!showOutputCell}
          onChange={handleOutputInput}
        >
          {showOutputCell && (
            <>
              <option value="ReturnValue">ReturnValue</option>
              <option value="Argument[this]">Argument[this]</option>
              {argumentsList.map((argument, index) => (
                <option key={argument} value={`Argument[${index}]`}>
                  Argument[{index}]: {argument}
                </option>
              ))}
            </>
          )}
        </Dropdown>
      </VSCodeDataGridCell>
      <VSCodeDataGridCell gridColumn={5}>
        <KindInput
          kinds={predicate?.supportedKinds || []}
          value={showKindCell && modeledMethod?.kind}
          disabled={!showKindCell}
          onChange={handleKindChange}
        />
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
};
