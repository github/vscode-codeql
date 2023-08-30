import * as React from "react";
import { styled } from "styled-components";
import { ModelingStatusIndicator } from "../model-editor/ModelingStatusIndicator";

const Container = styled.div`
  background-color: var(--vscode-peekViewResult-background);
  padding: 0.3rem;
  margin-bottom: 1rem;
`;

const Title = styled.div`
  padding-bottom: 0.3rem;
  font-size: 1.2em;
`;

const DependencyBox = styled.div`
  display: flex;
  justify-content: space-between;
`;

const DependencyName = styled.span`
  font-family: var(--vscode-editor-font-family);
`;

export const MethodModeling = (): JSX.Element => {
  return (
    <Container>
      <Title>API or Method</Title>
      <DependencyBox>
        <DependencyName>that.dependency.THENAME</DependencyName>
        <ModelingStatusIndicator status="unmodeled" />
      </DependencyBox>
    </Container>
  );
};
