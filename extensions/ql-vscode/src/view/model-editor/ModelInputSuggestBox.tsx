import { useEffect, useMemo, useState } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  modeledMethodSupportsInput,
} from "../../model-editor/modeled-method";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { SuggestBox } from "../common/SuggestBox";
import { useDebounceCallback } from "../common/useDebounceCallback";
import type { AccessPathDiagnostic } from "../../model-editor/shared/access-paths";
import {
  parseAccessPathTokens,
  validateAccessPath,
} from "../../model-editor/shared/access-paths";
import { ModelSuggestionIcon } from "./ModelSuggestionIcon";
import { ModelTypePathSuggestBox } from "./ModelTypePathSuggestBox";

type Props = {
  modeledMethod: ModeledMethod | undefined;
  suggestions: AccessPathOption[];
  typePathSuggestions: AccessPathOption[];
  onChange: (modeledMethod: ModeledMethod) => void;
};

const parseValueToTokens = (value: string) =>
  parseAccessPathTokens(value).map((t) => t.text);

const getIcon = (option: AccessPathOption) => (
  <ModelSuggestionIcon name={option.icon} />
);

const getDetails = (option: AccessPathOption) => option.details;

export const ModelInputSuggestBox = ({
  modeledMethod,
  suggestions,
  typePathSuggestions,
  onChange,
}: Props) => {
  const [value, setValue] = useState<string | undefined>(
    modeledMethod && modeledMethodSupportsInput(modeledMethod)
      ? modeledMethod.input
      : undefined,
  );

  useEffect(() => {
    if (modeledMethod && modeledMethodSupportsInput(modeledMethod)) {
      setValue(modeledMethod.input);
    }
  }, [modeledMethod]);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
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
    500,
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
    <SuggestBox<AccessPathOption, AccessPathDiagnostic>
      value={value}
      onChange={setValue}
      options={suggestions}
      parseValueToTokens={parseValueToTokens}
      validateValue={validateAccessPath}
      getIcon={getIcon}
      getDetails={getDetails}
      disabled={!enabled}
      aria-label="Input"
    />
  );
};
