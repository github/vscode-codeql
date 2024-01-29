import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  isModelAccepted,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import type { Method } from "../../model-editor/method";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import type { QueryLanguage } from "../../common/query-language";
import type { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { InputDropdown } from "./InputDropdown";
import { ModelTypeTextbox } from "./ModelTypeTextbox";

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
}: Props): React.JSX.Element => {
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
      <ModelTypeTextbox
        modeledMethod={modeledMethod}
        typeInfo="relatedTypeName"
        onChange={onChange}
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
