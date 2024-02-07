import { useCallback, useMemo } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { ModelTypeTextbox } from "./ModelTypeTextbox";
import { AccessPathSuggestBox } from "./AccessPathSuggestBox";

type Props = {
  modeledMethod: ModeledMethod | undefined;
  suggestions: AccessPathOption[];
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelOutputSuggestBox = ({
  modeledMethod,
  suggestions,
  onChange,
}: Props) => {
  const handleChange = useCallback(
    (output: string | undefined) => {
      if (
        !modeledMethod ||
        !modeledMethodSupportsOutput(modeledMethod) ||
        output === undefined
      ) {
        return;
      }

      onChange({
        ...modeledMethod,
        provenance: calculateNewProvenance(modeledMethod),
        output,
      });
    },
    [modeledMethod, onChange],
  );

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsOutput(modeledMethod),
    [modeledMethod],
  );

  if (modeledMethod?.type === "type") {
    return (
      <ModelTypeTextbox
        modeledMethod={modeledMethod}
        typeInfo="relatedTypeName"
        onChange={onChange}
        aria-label="Related type name"
      />
    );
  }

  return (
    <AccessPathSuggestBox
      value={
        modeledMethod && modeledMethodSupportsOutput(modeledMethod)
          ? modeledMethod.output
          : undefined
      }
      suggestions={suggestions}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Output"
    />
  );
};
