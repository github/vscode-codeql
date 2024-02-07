import { useEffect, useState } from "react";
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
  value: string | undefined;
  onChange: (value: string) => void;
  suggestions: AccessPathOption[];
  disabled?: boolean;

  "aria-label": string;
};

const parseValueToTokens = (value: string) =>
  parseAccessPathTokens(value).map((t) => t.text);

const getIcon = (option: AccessPathOption) => (
  <ModelSuggestionIcon name={option.icon} />
);

const getDetails = (option: AccessPathOption) => option.details;

export const AccessPathSuggestBox = ({
  value: givenValue,
  suggestions,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: Props) => {
  const [value, setValue] = useState<string | undefined>(givenValue);

  useEffect(() => {
    setValue(givenValue);
  }, [givenValue]);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
    (newValue: string | undefined) => {
      if (newValue === undefined) {
        return;
      }

      onChange(newValue);
    },
    500,
  );

  return (
    <SuggestBox<AccessPathOption, AccessPathDiagnostic>
      value={value}
      onChange={setValue}
      options={suggestions}
      parseValueToTokens={parseValueToTokens}
      validateValue={validateAccessPath}
      getIcon={getIcon}
      getDetails={getDetails}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
};
