import * as React from "react";
import { ChangeEvent, useCallback } from "react";
import { Dropdown } from "../common/Dropdown";
import {
  ModeledMethod,
  modeledMethodSupportsProvenance,
  ModeledMethodType,
  Provenance,
} from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { createEmptyModeledMethod } from "../../model-editor/modeled-method-empty";
import { Mutable } from "../../common/mutable";
import { QueryLanguage } from "../../common/query-language";
import { getModelsAsDataLanguage } from "../../model-editor/languages";

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
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelTypeDropdown = ({
  language,
  method,
  modeledMethod,
  onChange,
}: Props): JSX.Element => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const modelsAsDataLanguage = getModelsAsDataLanguage(language);

      let newProvenance: Provenance = "manual";
      if (modeledMethod && modeledMethodSupportsProvenance(modeledMethod)) {
        if (modeledMethod.provenance === "df-generated") {
          newProvenance = "df-manual";
        } else if (modeledMethod.provenance === "ai-generated") {
          newProvenance = "ai-manual";
        }
      }

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
        updatedModeledMethod.provenance = newProvenance;
      }
      if ("kind" in updatedModeledMethod) {
        updatedModeledMethod.kind = "value";
      }

      onChange(updatedModeledMethod);
    },
    [onChange, method, modeledMethod, language],
  );

  return (
    <Dropdown
      value={modeledMethod?.type ?? "none"}
      options={options}
      onChange={handleChange}
      aria-label="Model type"
    />
  );
};
