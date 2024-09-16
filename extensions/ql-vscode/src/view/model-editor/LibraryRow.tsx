import { useCallback, useEffect, useMemo, useState } from "react";
import { styled } from "styled-components";
import type { Method } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { ModeledMethodDataGrid } from "./ModeledMethodDataGrid";
import { calculateModeledPercentage } from "../../model-editor/shared/modeled-percentage";
import { percentFormatter } from "./formatters";
import { Codicon } from "../common";
import { Mode } from "../../model-editor/shared/mode";
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import type { ModelEditorViewState } from "../../model-editor/shared/view-state";
import type { AccessPathSuggestionOptions } from "../../model-editor/suggestions";
import type { ModelEvaluationRunState } from "../../model-editor/shared/model-evaluation-run-state";

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

export type LibraryRowProps = {
  title: string;
  libraryVersion?: string;
  methods: Method[];
  modeledMethodsMap: Record<string, ModeledMethod[]>;
  modifiedSignatures: Set<string>;
  selectedSignatures: Set<string>;
  viewState: ModelEditorViewState;
  hideModeledMethods: boolean;
  revealedMethodSignature: string | null;
  accessPathSuggestions?: AccessPathSuggestionOptions;
  evaluationRun: ModelEvaluationRunState | undefined;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
  onMethodClick: (methodSignature: string) => void;
  onSaveModelClick: (methodSignatures: string[]) => void;
  onGenerateFromSourceClick: () => void;
  onModelDependencyClick: () => void;
};

export const LibraryRow = ({
  title,
  libraryVersion,
  methods,
  modeledMethodsMap,
  modifiedSignatures,
  selectedSignatures,
  viewState,
  hideModeledMethods,
  revealedMethodSignature,
  accessPathSuggestions,
  evaluationRun,
  onChange,
  onMethodClick,
  onSaveModelClick,
  onGenerateFromSourceClick,
  onModelDependencyClick,
}: LibraryRowProps) => {
  const modeledPercentage = useMemo(() => {
    return calculateModeledPercentage(methods);
  }, [methods]);

  const [isExpanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(async () => {
    setExpanded((oldIsExpanded) => !oldIsExpanded);
  }, []);

  useEffect(() => {
    // If any of the methods in this group is the one that should be revealed, we should expand
    // this group so the method can highlight itself.
    if (methods.some((m) => m.signature === revealedMethodSignature)) {
      setExpanded(true);
    }
  }, [methods, revealedMethodSignature]);

  const handleModelFromSource = useCallback(
    async (e: React.MouseEvent) => {
      onGenerateFromSourceClick();
      e.stopPropagation();
      e.preventDefault();
    },
    [onGenerateFromSourceClick],
  );

  const handleModelDependency = useCallback(
    async (e: React.MouseEvent) => {
      onModelDependencyClick();
      e.stopPropagation();
      e.preventDefault();
    },
    [onModelDependencyClick],
  );

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      onSaveModelClick(methods.map((m) => m.signature));
      e.stopPropagation();
      e.preventDefault();
    },
    [methods, onSaveModelClick],
  );

  const hasUnsavedChanges = useMemo(() => {
    return methods.some((method) => modifiedSignatures.has(method.signature));
  }, [methods, modifiedSignatures]);

  return (
    <LibraryContainer>
      <TitleContainer onClick={toggleExpanded} aria-expanded={isExpanded}>
        {isExpanded ? (
          <Codicon name="chevron-down" label="Collapse" />
        ) : (
          <Codicon name="chevron-right" label="Expand" />
        )}
        <NameContainer>
          <DependencyName>
            {title}
            {libraryVersion && <>@{libraryVersion}</>}
          </DependencyName>
          <ModeledPercentage>
            {percentFormatter.format(modeledPercentage / 100)} modeled
          </ModeledPercentage>
          {hasUnsavedChanges ? <VSCodeTag>UNSAVED</VSCodeTag> : null}
        </NameContainer>
        {viewState.showGenerateButton &&
          viewState.mode === Mode.Application && (
            <VSCodeButton appearance="icon" onClick={handleModelFromSource}>
              <Codicon name="code" label="Model from source" />
              &nbsp;Model from source
            </VSCodeButton>
          )}
        {viewState.mode === Mode.Application && (
          <VSCodeButton appearance="icon" onClick={handleModelDependency}>
            <Codicon name="references" label="Model dependency" />
            &nbsp;Model dependency
          </VSCodeButton>
        )}
      </TitleContainer>
      {isExpanded && (
        <>
          <SectionDivider />
          <ModeledMethodDataGrid
            methods={methods}
            modeledMethodsMap={modeledMethodsMap}
            modifiedSignatures={modifiedSignatures}
            selectedSignatures={selectedSignatures}
            viewState={viewState}
            hideModeledMethods={hideModeledMethods}
            revealedMethodSignature={revealedMethodSignature}
            accessPathSuggestions={accessPathSuggestions}
            evaluationRun={evaluationRun}
            onChange={onChange}
            onMethodClick={onMethodClick}
          />
          <SectionDivider />
          <ButtonsContainer>
            <VSCodeButton onClick={handleSave} disabled={!hasUnsavedChanges}>
              {selectedSignatures.size === 0 ? "Save" : "Save selected"}
            </VSCodeButton>
          </ButtonsContainer>
        </>
      )}
    </LibraryContainer>
  );
};
