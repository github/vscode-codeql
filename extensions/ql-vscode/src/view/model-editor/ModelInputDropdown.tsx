import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import {
  ModeledMethod,
  isModelAccepted,
  modeledMethodSupportsInput,
} from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { ReadonlyDropdown } from "../common/ReadonlyDropdown";
import { QueryLanguage } from "../../common/query-language";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { InputDropdown } from "./InputDropdown";

type Props = {
  language: QueryLanguage;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  modelingStatus: ModelingStatus;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelInputDropdown = ({
  language,
  method,
  modeledMethod,
  modelingStatus,
  onChange,
}: Props): JSX.Element => {
  const options = useMemo(() => {
    const modelsAsDataLanguage = getModelsAsDataLanguage(language);

    return modelsAsDataLanguage
      .getArgumentOptions(method)
      .options.map((option) => ({
        value: option.path,
        label: option.label,
      }));
  }, [language, method]);

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsInput(modeledMethod),
    [modeledMethod],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod || !modeledMethodSupportsInput(modeledMethod)) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange({
        ...modeledMethod,
        input: target.value,
      });
    },
    [onChange, modeledMethod],
  );

  const value =
    modeledMethod && modeledMethodSupportsInput(modeledMethod)
      ? modeledMethod.input
      : undefined;

  if (modeledMethod?.type === "type") {
    return <ReadonlyDropdown value={modeledMethod.path} aria-label="Path" />;
  }

  const modelAccepted = isModelAccepted(modeledMethod, modelingStatus);

  return (
    <InputDropdown
      value={value}
      options={options}
      disabled={!enabled}
      $accepted={modelAccepted}
      onChange={handleChange}
      aria-label="Input"
    />
  );
};
