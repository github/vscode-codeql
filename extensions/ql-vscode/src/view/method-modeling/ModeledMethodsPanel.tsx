import * as React from "react";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { Method } from "../../model-editor/method";
import { styled } from "styled-components";
import { MultipleModeledMethodsPanel } from "./MultipleModeledMethodsPanel";

type Props = {
  method: Method;
  modeledMethods: ModeledMethod[];
  showMultipleModels: boolean;
  onChange: (modeledMethod: ModeledMethod) => void;
};

const SingleMethodModelingInputs = styled(MethodModelingInputs)`
  padding-bottom: 0.5rem;
`;

export const ModeledMethodsPanel = ({
  method,
  modeledMethods,
  showMultipleModels,
  onChange,
}: Props) => {
  if (!showMultipleModels) {
    return (
      <SingleMethodModelingInputs
        method={method}
        modeledMethod={
          modeledMethods.length > 0 ? modeledMethods[0] : undefined
        }
        onChange={onChange}
      />
    );
  }

  return (
    <MultipleModeledMethodsPanel
      method={method}
      modeledMethods={modeledMethods}
      onChange={onChange}
    />
  );
};
