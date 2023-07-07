import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { ModeledMethodDataGrid } from "./ModeledMethodDataGrid";
import { calculateModeledPercentage } from "../../data-extensions-editor/shared/modeled-percentage";
import { percentFormatter } from "./formatters";
import { Codicon } from "../common";
import { Mode } from "../../data-extensions-editor/shared/mode";
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";

const LibraryContainer = styled.div`
  background-color: var(--vscode-peekViewResult-background);
  padding: 0.3rem;
  margin-bottom: 1rem;
  border-radius: 0.3rem;
`;

const TitleContainer = styled.button`
  display: flex;
  gap: 0.5em;
  align-items: center;
  width: 100%;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;

  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;
`;

const SectionDivider = styled(VSCodeDivider)`
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
`;

const NameContainer = styled.div`
  display: flex;
  gap: 0.5em;
  align-items: baseline;
  flex-grow: 1;
  text-align: left;
`;

const DependencyName = styled.span`
  font-size: 1.2em;
  font-weight: bold;
`;

const ModeledPercentage = styled.span`
  color: var(--vscode-descriptionForeground);
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 0.4em;
  justify-content: right;
  margin-bottom: 1rem;
  margin-right: 1rem;
`;

type Props = {
  title: string;
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  mode: Mode;
  hasUnsavedChanges: boolean;
  onChange: (
    modelName: string,
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
  onSaveModelClick: (
    modelName: string,
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
  onGenerateFromLlmClick: (
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
};

export const LibraryRow = ({
  title,
  externalApiUsages,
  modeledMethods,
  mode,
  hasUnsavedChanges,
  onChange,
  onSaveModelClick,
  onGenerateFromLlmClick,
}: Props) => {
  const modeledPercentage = useMemo(() => {
    return calculateModeledPercentage(externalApiUsages);
  }, [externalApiUsages]);

  const [isExpanded, setExpanded] = useState(modeledPercentage < 100);

  const toggleExpanded = useCallback(async () => {
    setExpanded((oldIsExpanded) => !oldIsExpanded);
  }, []);

  const handleModelWithAI = useCallback(
    async (e: React.MouseEvent) => {
      onGenerateFromLlmClick(externalApiUsages, modeledMethods);
      e.stopPropagation();
      e.preventDefault();
    },
    [externalApiUsages, modeledMethods, onGenerateFromLlmClick],
  );

  const handleModelFromSource = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      onSaveModelClick(title, externalApiUsages, modeledMethods);
      e.stopPropagation();
      e.preventDefault();
    },
    [title, externalApiUsages, modeledMethods, onSaveModelClick],
  );

  const onChangeWithModelName = useCallback(
    (externalApiUsage: ExternalApiUsage, modeledMethod: ModeledMethod) => {
      onChange(title, externalApiUsage, modeledMethod);
    },
    [onChange, title],
  );

  return (
    <LibraryContainer>
      <TitleContainer onClick={toggleExpanded} aria-expanded={isExpanded}>
        {isExpanded ? (
          <Codicon name="chevron-down" label="Collapse" />
        ) : (
          <Codicon name="chevron-right" label="Expand" />
        )}
        <NameContainer>
          <DependencyName>{title}</DependencyName>
          <ModeledPercentage>
            {percentFormatter.format(modeledPercentage / 100)} modeled
          </ModeledPercentage>
          {hasUnsavedChanges ? <VSCodeTag>UNSAVED</VSCodeTag> : null}
        </NameContainer>
        <VSCodeButton appearance="icon" onClick={handleModelWithAI}>
          <Codicon name="lightbulb-autofix" label="Model with AI" />
          &nbsp;Model with AI
        </VSCodeButton>
        <VSCodeButton appearance="icon" onClick={handleModelFromSource}>
          <Codicon name="code" label="Model from source" />
          &nbsp;Model from source
        </VSCodeButton>
      </TitleContainer>
      {isExpanded && (
        <>
          <SectionDivider />
          <ModeledMethodDataGrid
            externalApiUsages={externalApiUsages}
            modeledMethods={modeledMethods}
            mode={mode}
            onChange={onChangeWithModelName}
          />
          <SectionDivider />
          <ButtonsContainer>
            <VSCodeButton onClick={handleSave} disabled={!hasUnsavedChanges}>
              Save
            </VSCodeButton>
          </ButtonsContainer>
        </>
      )}
    </LibraryContainer>
  );
};
