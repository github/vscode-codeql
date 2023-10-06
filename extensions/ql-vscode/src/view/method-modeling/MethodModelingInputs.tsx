import * as React from "react";
import { styled } from "styled-components";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelTypeDropdown } from "../model-editor/ModelTypeDropdown";
import { ModelInputDropdown } from "../model-editor/ModelInputDropdown";
import { ModelOutputDropdown } from "../model-editor/ModelOutputDropdown";
import { ModelKindDropdown } from "../model-editor/ModelKindDropdown";

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
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodModelingInputs = ({
  method,
  modeledMethod,
  onChange,
}: MethodModelingInputsProps): JSX.Element => {
  const inputProps = {
    method,
    modeledMethod,
    onChange,
  };

  return (
    <>
      <Container>
        <Input>
          <Name>Model Type</Name>
          <ModelTypeDropdown {...inputProps} />
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Input</Name>
          <ModelInputDropdown {...inputProps} />
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Output</Name>
          <ModelOutputDropdown {...inputProps} />
        </Input>
      </Container>
      <Container>
        <Input>
          <Name>Kind</Name>
          <ModelKindDropdown {...inputProps} />
        </Input>
      </Container>
    </>
  );
};
