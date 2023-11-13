import * as React from "react";
import { styled } from "styled-components";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { ModelTypeDropdown } from "../model-editor/ModelTypeDropdown";
import { ModelInputDropdown } from "../model-editor/ModelInputDropdown";
import { ModelOutputDropdown } from "../model-editor/ModelOutputDropdown";
import { ModelKindDropdown } from "../model-editor/ModelKindDropdown";
import { InProgressDropdown } from "../model-editor/InProgressDropdown";
import { QueryLanguage } from "../../common/query-language";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";

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
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  modelingStatus: ModelingStatus;
  isModelingInProgress: boolean;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const MethodModelingInputs = ({
  language,
  method,
  modeledMethod,
  modelingStatus,
  isModelingInProgress,
  onChange,
}: MethodModelingInputsProps): JSX.Element => {
  const inputProps = {
    language,
    method,
    modeledMethod,
    modelingStatus,
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
            <ModelTypeDropdown {...inputProps} />
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
