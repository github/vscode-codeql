import * as React from "react";
import { styled } from "styled-components";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "../model-editor/ModelingStatusIndicator";
import { Method } from "../../model-editor/method";
import { MethodName } from "../model-editor/MethodName";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { MethodModelingInputs } from "./MethodModelingInputs";

const Container = styled.div`
  padding: 0.3rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const Title = styled.div`
  padding-bottom: 0.3rem;
  font-size: 0.7rem;
  text-transform: uppercase;
`;

const DependencyContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
  background-color: var(--vscode-textBlockQuote-background);
  border-radius: 0.3rem;
  border-color: var(--vscode-textBlockQuote-border);
  padding: 0.5rem;
`;

export type MethodModelingProps = {
  modelingStatus: ModelingStatus;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
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
    </Container>
  );
};
