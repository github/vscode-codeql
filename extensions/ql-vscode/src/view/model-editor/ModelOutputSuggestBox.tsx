import { useEffect, useMemo, useState } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import { ReadonlyDropdown } from "../common/ReadonlyDropdown";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { SuggestBox } from "../common/SuggestBox";
import { useDebounceCallback } from "../common/useDebounceCallback";

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
  const [value, setValue] = useState<string | undefined>(
    modeledMethod && modeledMethodSupportsOutput(modeledMethod)
      ? modeledMethod.output
      : undefined,
  );

  useEffect(() => {
    if (modeledMethod && modeledMethodSupportsOutput(modeledMethod)) {
      setValue(modeledMethod.output);
    }
  }, [modeledMethod]);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
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
    500,
  );

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsOutput(modeledMethod),
    [modeledMethod],
  );

  if (modeledMethod?.type === "type") {
    return (
      <ReadonlyDropdown
        value={modeledMethod.relatedTypeName}
        aria-label="Related type name"
      />
    );
  }

  return (
    <SuggestBox
      value={value}
      options={suggestions}
      disabled={!enabled}
      onChange={setValue}
      aria-label="Output"
    />
  );
};
