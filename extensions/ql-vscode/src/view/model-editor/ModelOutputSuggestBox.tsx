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
import type { AccessPathDiagnostic } from "../../model-editor/shared/access-paths";
import {
  parseAccessPathTokens,
  validateAccessPath,
} from "../../model-editor/shared/access-paths";
import { ModelSuggestionIcon } from "./ModelSuggestionIcon";

type Props = {
  modeledMethod: ModeledMethod | undefined;
  suggestions: AccessPathOption[];
  onChange: (modeledMethod: ModeledMethod) => void;
};

const parseValueToTokens = (value: string) =>
  parseAccessPathTokens(value).map((t) => t.text);

const getIcon = (option: AccessPathOption) => (
  <ModelSuggestionIcon name={option.icon} />
);

const getDetails = (option: AccessPathOption) => option.details;

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
    <SuggestBox<AccessPathOption, AccessPathDiagnostic>
      value={value}
      options={suggestions}
      disabled={!enabled}
      onChange={setValue}
      parseValueToTokens={parseValueToTokens}
      validateValue={validateAccessPath}
      getIcon={getIcon}
      getDetails={getDetails}
      aria-label="Output"
    />
  );
};
