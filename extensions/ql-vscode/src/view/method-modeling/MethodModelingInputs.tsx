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

const Label = styled.span`
  display: block;
  padding-bottom: 0.3rem;
`;

export type MethodModelingInputsProps = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (method: Method, modeledMethod: ModeledMethod) => void;
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
        <Label>Model Type</Label>
        <ModelTypeDropdown {...inputProps} />
      </Container>
      <Container>
        <Label>Input</Label>
        <ModelInputDropdown {...inputProps} />
      </Container>
      <Container>
        <Label>Output</Label>
        <ModelOutputDropdown {...inputProps} />
      </Container>
      <Container>
        <Label>Kind</Label>
        <ModelKindDropdown {...inputProps} />
      </Container>
    </>
  );
};
