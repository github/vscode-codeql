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
import { VSCodeButton, VSCodeDivider } from "@vscode/webview-ui-toolkit/react";

const LibraryContainer = styled.div`
  margin-bottom: 1rem;
`;

const TitleContainer = styled.button`
  display: flex;
  gap: 0.5em;
  align-items: center;
  width: 100%;

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

const UnsavedLabel = styled.span`
  text-transform: uppercase;
  background-color: var(--vscode-input-background);
  padding: 0.2em 0.4em;
  border-radius: 0.2em;
`;

const TitleButton = styled(VSCodeButton)`
  background-color: transparent;

  &:hover {
    pointer: cursor;
    background-color: var(--vscode-button-secondaryBackground);
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 0.4em;
  justify-content: right;
  margin-bottom: 1rem;
`;

type Props = {
  title: string;
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  mode: Mode;
  hasUnsavedChanges: boolean;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const LibraryRow = ({
  title,
  externalApiUsages,
  modeledMethods,
  mode,
  hasUnsavedChanges,
  onChange,
}: Props) => {
  const modeledPercentage = useMemo(() => {
    return calculateModeledPercentage(externalApiUsages);
  }, [externalApiUsages]);

  const [isExpanded, setExpanded] = useState(modeledPercentage < 100);

  const toggleExpanded = useCallback(async () => {
    setExpanded((oldIsExpanded) => !oldIsExpanded);
  }, []);

  const handleModelWithAI = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const handleModelFromSource = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

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
          {hasUnsavedChanges ? <UnsavedLabel>UNSAVED</UnsavedLabel> : null}
        </NameContainer>
        <TitleButton onClick={handleModelWithAI}>
          <Codicon name="lightbulb-autofix" label="Model with AI" />
          &nbsp;Model with AI
        </TitleButton>
        <TitleButton onClick={handleModelFromSource}>
          <Codicon name="code" label="Model from source" />
          &nbsp;Model from source
        </TitleButton>
      </TitleContainer>
      {isExpanded && (
        <>
          <SectionDivider />
          <ModeledMethodDataGrid
            externalApiUsages={externalApiUsages}
            modeledMethods={modeledMethods}
            mode={mode}
            onChange={onChange}
          />
          <SectionDivider />
          <ButtonsContainer>
            <VSCodeButton onClick={handleSave}>Save</VSCodeButton>
          </ButtonsContainer>
        </>
      )}
    </LibraryContainer>
  );
};
