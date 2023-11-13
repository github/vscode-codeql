import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import {
  ModeledMethod,
  calculateNewProvenance,
  isModelAccepted,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { ReadonlyDropdown } from "../common/ReadonlyDropdown";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { QueryLanguage } from "../../common/query-language";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { InputDropdown } from "./InputDropdown";

type Props = {
  language: QueryLanguage;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  modelingStatus: ModelingStatus;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelOutputDropdown = ({
  language,
  method,
  modeledMethod,
  modelingStatus,
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
        provenance: calculateNewProvenance(modeledMethod),
        output: target.value,
      });
    },
    [onChange, modeledMethod],
  );

  const value =
    modeledMethod && modeledMethodSupportsOutput(modeledMethod)
      ? modeledMethod.output
      : undefined;

  if (modeledMethod?.type === "type") {
    return (
      <ReadonlyDropdown
        value={modeledMethod.relatedTypeName}
        aria-label="Related type name"
      />
    );
  }

  const modelAccepted = isModelAccepted(modeledMethod, modelingStatus);

  return (
    <InputDropdown
      value={value}
      options={options}
      disabled={!enabled}
      $accepted={modelAccepted}
      onChange={handleChange}
      aria-label="Output"
    />
  );
};
