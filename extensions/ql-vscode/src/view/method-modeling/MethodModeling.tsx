import * as React from "react";
import { styled } from "styled-components";
import {
  ModelingStatus,
  ModelingStatusIndicator,
} from "../model-editor/ModelingStatusIndicator";
import { ExternalApiUsage } from "../../model-editor/external-api-usage";
import { ExternalApiUsageName } from "../model-editor/ExternalApiUsageName";

const Container = styled.div`
  background-color: var(--vscode-peekViewResult-background);
  padding: 0.3rem;
  margin-bottom: 1rem;
`;

const Title = styled.div`
  padding-bottom: 0.3rem;
  font-size: 1.2em;
`;

const DependencyContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

export type MethodModelingProps = {
  modelingStatus: ModelingStatus;
  externalApiUsage: ExternalApiUsage;
};

export const MethodModeling = ({
  modelingStatus,
  externalApiUsage,
}: MethodModelingProps): JSX.Element => {
  return (
    <Container>
      <Title>API or Method</Title>
      <DependencyContainer>
        <ExternalApiUsageName {...externalApiUsage} />
        <ModelingStatusIndicator status={modelingStatus} />
      </DependencyContainer>
    </Container>
  );
};
