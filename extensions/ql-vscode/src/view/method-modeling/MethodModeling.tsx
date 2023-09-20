import * as React from "react";
import { styled } from "styled-components";
import {
  ModelingStatus,
  ModelingStatusIndicator,
} from "../model-editor/ModelingStatusIndicator";
import { Method } from "../../model-editor/method";
import { MethodName } from "../model-editor/MethodName";

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
};

export const MethodModeling = ({
  modelingStatus,
  method,
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
    </Container>
  );
};
