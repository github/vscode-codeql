import * as React from "react";
import { useCallback } from "react";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { Method } from "../../model-editor/method";
import { styled } from "styled-components";
import { MultipleModeledMethodsPanel } from "./MultipleModeledMethodsPanel";
import { convertToLegacyModeledMethod } from "../../model-editor/shared/modeled-methods-legacy";

export type ModeledMethodsPanelProps = {
  method: Method;
  modeledMethods: ModeledMethod[];
  showMultipleModels: boolean;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

const SingleMethodModelingInputs = styled(MethodModelingInputs)`
  padding-bottom: 0.5rem;
`;

export const ModeledMethodsPanel = ({
  method,
  modeledMethods,
  showMultipleModels,
  onChange,
}: ModeledMethodsPanelProps) => {
  const handleSingleChange = useCallback(
    (modeledMethod: ModeledMethod) => {
      onChange(modeledMethod.signature, [modeledMethod]);
    },
    [onChange],
  );

  if (!showMultipleModels) {
    return (
      <SingleMethodModelingInputs
        method={method}
        modeledMethod={convertToLegacyModeledMethod(modeledMethods)}
        onChange={handleSingleChange}
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
