import { useEffect, useState } from "react";
import type { TypeModeledMethod } from "../../model-editor/modeled-method";
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
  modeledMethod: TypeModeledMethod;
  suggestions: AccessPathOption[];
  onChange: (modeledMethod: TypeModeledMethod) => void;
};

const parseValueToTokens = (value: string) =>
  parseAccessPathTokens(value).map((t) => t.text);

const getIcon = (option: AccessPathOption) => (
  <ModelSuggestionIcon name={option.icon} />
);

const getDetails = (option: AccessPathOption) => option.details;

export const ModelTypePathSuggestBox = ({
  modeledMethod,
  suggestions,
  onChange,
}: Props) => {
  const [value, setValue] = useState<string | undefined>(modeledMethod.path);

  useEffect(() => {
    setValue(modeledMethod.path);
  }, [modeledMethod]);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
    (path: string | undefined) => {
      if (path === undefined) {
        return;
      }

      onChange({
        ...modeledMethod,
        path,
      });
    },
    500,
  );

  return (
    <SuggestBox<AccessPathOption, AccessPathDiagnostic>
      value={value}
      options={suggestions}
      onChange={setValue}
      parseValueToTokens={parseValueToTokens}
      validateValue={validateAccessPath}
      getIcon={getIcon}
      getDetails={getDetails}
      aria-label="Path"
    />
  );
};
