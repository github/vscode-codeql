import * as React from "react";
import { ChangeEvent, useCallback } from "react";
import {
  calculateNewProvenance,
  isModelAccepted,
  ModeledMethod,
  ModeledMethodType,
} from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { createEmptyModeledMethod } from "../../model-editor/modeled-method-empty";
import { Mutable } from "../../common/mutable";
import { ReadonlyDropdown } from "../common/ReadonlyDropdown";
import { QueryLanguage } from "../../common/query-language";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { InputDropdown } from "./InputDropdown";

const options: Array<{ value: ModeledMethodType; label: string }> = [
  { value: "none", label: "Unmodeled" },
  { value: "source", label: "Source" },
  { value: "sink", label: "Sink" },
  { value: "summary", label: "Flow summary" },
  { value: "neutral", label: "Neutral" },
];

type Props = {
  language: QueryLanguage;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  modelingStatus: ModelingStatus;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelTypeDropdown = ({
  language,
  method,
  modeledMethod,
  modelingStatus,
  onChange,
}: Props): JSX.Element => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const modelsAsDataLanguage = getModelsAsDataLanguage(language);

      const emptyModeledMethod = createEmptyModeledMethod(
        e.target.value as ModeledMethodType,
        method,
      );
      const updatedModeledMethod: Mutable<ModeledMethod> = {
        ...emptyModeledMethod,
      };
      if ("input" in updatedModeledMethod) {
        updatedModeledMethod.input =
          modelsAsDataLanguage.getArgumentOptions(method).defaultArgumentPath;
      }
      if ("output" in updatedModeledMethod) {
        updatedModeledMethod.output = "ReturnValue";
      }
      if ("provenance" in updatedModeledMethod) {
        updatedModeledMethod.provenance = calculateNewProvenance(modeledMethod);
      }
      if ("kind" in updatedModeledMethod) {
        updatedModeledMethod.kind = "value";
      }

      onChange(updatedModeledMethod);
    },
    [onChange, method, modeledMethod, language],
  );

  const value = modeledMethod?.type ?? "none";

  const isShownOption = options.some((option) => option.value === value);

  if (!isShownOption) {
    return (
      <ReadonlyDropdown
        // Try to show this like a normal type with uppercased first letter
        value={value.charAt(0).toUpperCase() + value.slice(1)}
        aria-label="Model type"
      />
    );
  }

  const modelAccepted = isModelAccepted(modeledMethod, modelingStatus);

  return (
    <InputDropdown
      value={modeledMethod?.type ?? "none"}
      options={options}
      $accepted={modelAccepted}
      onChange={handleChange}
      aria-label="Model type"
    />
  );
};
