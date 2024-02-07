import { useCallback, useMemo } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  modeledMethodSupportsInput,
} from "../../model-editor/modeled-method";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { ModelTypePathSuggestBox } from "./ModelTypePathSuggestBox";
import { AccessPathSuggestBox } from "./AccessPathSuggestBox";

type Props = {
  modeledMethod: ModeledMethod | undefined;
  suggestions: AccessPathOption[];
  typePathSuggestions: AccessPathOption[];
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelInputSuggestBox = ({
  modeledMethod,
  suggestions,
  typePathSuggestions,
  onChange,
}: Props) => {
  const handleChange = useCallback(
    (input: string | undefined) => {
      if (
        !modeledMethod ||
        !modeledMethodSupportsInput(modeledMethod) ||
        input === undefined
      ) {
        return;
      }

      onChange({
        ...modeledMethod,
        provenance: calculateNewProvenance(modeledMethod),
        input,
      });
    },
    [onChange, modeledMethod],
  );

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsInput(modeledMethod),
    [modeledMethod],
  );

  if (modeledMethod?.type === "type") {
    return (
      <ModelTypePathSuggestBox
        modeledMethod={modeledMethod}
        suggestions={typePathSuggestions}
        onChange={onChange}
      />
    );
  }

  return (
    <AccessPathSuggestBox
      value={
        modeledMethod && modeledMethodSupportsInput(modeledMethod)
          ? modeledMethod.input
          : undefined
      }
      onChange={handleChange}
      suggestions={suggestions}
      disabled={!enabled}
      aria-label="Input"
    />
  );
};
