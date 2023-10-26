import * as React from "react";
import { styled } from "styled-components";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "../model-editor/ModelingStatusIndicator";
import { Method } from "../../model-editor/method";
import { MethodName } from "../model-editor/MethodName";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";
import { ReviewInEditorButton } from "./ReviewInEditorButton";
import { ModeledMethodsPanel } from "./ModeledMethodsPanel";
import { QueryLanguage } from "../../common/query-language";

const Container = styled.div`
  padding-top: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const Title = styled.div`
  padding-bottom: 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DependencyContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
  background-color: var(--vscode-editor-background);
  border: 0.05rem solid var(--vscode-panelSection-border);
  border-radius: 0.3rem;
  padding: 0.5rem;
  word-wrap: break-word;
  word-break: break-all;
  margin-bottom: 0.8rem;
`;

const StyledVSCodeTag = styled(VSCodeTag)<{ visible: boolean }>`
  visibility: ${(props) => (props.visible ? "visible" : "hidden")};
`;

const UnsavedTag = ({ modelingStatus }: { modelingStatus: ModelingStatus }) => (
  <StyledVSCodeTag visible={modelingStatus === "unsaved"}>
    Unsaved
  </StyledVSCodeTag>
);

export type MethodModelingProps = {
  language: QueryLanguage;
  modelingStatus: ModelingStatus;
  method: Method;
  modeledMethods: ModeledMethod[];
  isModelingInProgress: boolean;
  showMultipleModels?: boolean;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

export const MethodModeling = ({
  language,
  modelingStatus,
  modeledMethods,
  method,
  isModelingInProgress,
  showMultipleModels = false,
  onChange,
}: MethodModelingProps): JSX.Element => {
  return (
    <Container>
      <Title>
        {method.packageName}
        {method.libraryVersion && <>@{method.libraryVersion}</>}
        <UnsavedTag modelingStatus={modelingStatus} />
      </Title>
      <DependencyContainer>
        <ModelingStatusIndicator status={modelingStatus} />
        <MethodName {...method} />
      </DependencyContainer>
      <ModeledMethodsPanel
        language={language}
        method={method}
        modeledMethods={modeledMethods}
        showMultipleModels={showMultipleModels}
        isModelingInProgress={isModelingInProgress}
        onChange={onChange}
      />
      <ReviewInEditorButton method={method} />
    </Container>
  );
};
