import { styled } from "styled-components";
import {
  modeledMethodSupportsInput,
  modeledMethodSupportsKind,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import type { ModeledMethod } from "../../model-editor/modeled-method";

const DetailsContainer = styled.div`
  display: flex;
`;

const Detail = styled.span`
  display: flex;
  margin-right: 30px;
`;

const Label = styled.span`
  color: var(--vscode-descriptionForeground);
  margin-right: 10px;
`;

const Value = styled.span``;

export const ModelDetails = ({ model }: { model: ModeledMethod }) => {
  return (
    <DetailsContainer>
      <Detail>
        <Label>Model type:</Label>
        <Value>{model.type}</Value>
      </Detail>
      {modeledMethodSupportsInput(model) && (
        <Detail>
          <Label>Input:</Label>
          <Value>{model.input}</Value>
        </Detail>
      )}
      {modeledMethodSupportsOutput(model) && (
        <Detail>
          <Label>Output:</Label>
          <Value>{model.output}</Value>
        </Detail>
      )}
      {modeledMethodSupportsKind(model) && (
        <Detail>
          <Label>Kind:</Label>
          <Value>{model.kind}</Value>
        </Detail>
      )}
    </DetailsContainer>
  );
};
