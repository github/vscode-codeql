import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { Dropdown } from "../common/Dropdown";
import {
  ModeledMethod,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { QueryLanguage } from "../../common/query-language";

type Props = {
  language: QueryLanguage;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelOutputDropdown = ({
  language,
  method,
  modeledMethod,
  onChange,
}: Props): JSX.Element => {
  const options = useMemo(() => {
    const modelsAsDataLanguage = getModelsAsDataLanguage(language);

    const options = modelsAsDataLanguage
      .getArgumentOptions(method)
      .options.map((option) => ({
        value: option.path,
        label: option.label,
      }));
    return [{ value: "ReturnValue", label: "ReturnValue" }, ...options];
  }, [language, method]);

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsOutput(modeledMethod),
    [modeledMethod],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod || !modeledMethodSupportsOutput(modeledMethod)) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange({
        ...modeledMethod,
        output: target.value,
      });
    },
    [onChange, modeledMethod],
  );

  const value =
    modeledMethod && modeledMethodSupportsOutput(modeledMethod)
      ? modeledMethod.output
      : undefined;

  return (
    <Dropdown
      value={value}
      options={options}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Output"
    />
  );
};
