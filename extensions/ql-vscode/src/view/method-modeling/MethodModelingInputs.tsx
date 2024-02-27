import { styled } from "styled-components";
import type { Method } from "../../model-editor/method";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelTypeDropdown } from "../model-editor/ModelTypeDropdown";
import { ModelInputDropdown } from "../model-editor/ModelInputDropdown";
import { ModelOutputDropdown } from "../model-editor/ModelOutputDropdown";
import { ModelKindDropdown } from "../model-editor/ModelKindDropdown";
import { InProgressDropdown } from "../model-editor/InProgressDropdown";
import type { QueryLanguage } from "../../common/query-language";
import type { ModelConfig } from "../../model-editor/languages";

const Container = styled.div`
  padding-top: 0.5rem;
`;

const Input = styled.label`
  display: block;
  padding-bottom: 0.3rem;
`;

const Name = styled.span`
  display: block;
  padding-bottom: 0.5rem;
`;

export type MethodModelingInputsProps = {
  language: QueryLanguage;
  modelConfig: ModelConfig;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  modelPending: boolean;
  isModelingInProgress: boolean;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodModelingInputs = ({
  language,
  modelConfig,
  method,
  modeledMethod,
  modelPending,
  isModelingInProgress,
  onChange,
}: MethodModelingInputsProps): React.JSX.Element => {
  const inputProps = {
    language,
    method,
    modeledMethod,
    modelPending,
    onChange,
  };

  return (
    <>
      <Container>
        <Input>
          <Name>Model Type</Name>
          {isModelingInProgress ? (
            <InProgressDropdown />
          ) : (
            <ModelTypeDropdown modelConfig={modelConfig} {...inputProps} />
          )}
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Input</Name>
          {isModelingInProgress ? (
            <InProgressDropdown />
          ) : (
            <ModelInputDropdown {...inputProps} />
          )}
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Output</Name>
          {isModelingInProgress ? (
            <InProgressDropdown />
          ) : (
            <ModelOutputDropdown {...inputProps} />
          )}
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Kind</Name>
          {isModelingInProgress ? (
            <InProgressDropdown />
          ) : (
            <ModelKindDropdown {...inputProps} />
          )}
        </Input>
      </Container>
    </>
  );
};
