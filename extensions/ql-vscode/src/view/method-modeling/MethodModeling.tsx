import * as React from "react";
import { styled } from "styled-components";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "../model-editor/ModelingStatusIndicator";
import { Method } from "../../model-editor/method";
import { MethodName } from "../model-editor/MethodName";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";
import { ReviewInEditorButton } from "./ReviewInEditorButton";

const Container = styled.div`
  padding: 0.3rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const Title = styled.div`
  padding-bottom: 0.3rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
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
`;

export type MethodModelingProps = {
  modelingStatus: ModelingStatus;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  showMultipleModels?: boolean;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodModeling = ({
  modelingStatus,
  modeledMethod,
  method,
  onChange,
}: MethodModelingProps): JSX.Element => {
  return (
    <Container>
      <Title>
        {method.packageName}
        {method.libraryVersion && <>@{method.libraryVersion}</>}
        {modelingStatus === "unsaved" ? <VSCodeTag>Unsaved</VSCodeTag> : null}
      </Title>
      <DependencyContainer>
        <ModelingStatusIndicator status={modelingStatus} />
        <MethodName {...method} />
      </DependencyContainer>
      <MethodModelingInputs
        method={method}
        modeledMethod={modeledMethod}
        onChange={onChange}
      />
      <ReviewInEditorButton method={method} />
    </Container>
  );
};
