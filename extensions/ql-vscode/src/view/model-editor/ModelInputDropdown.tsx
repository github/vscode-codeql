import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import {
  calculateNewProvenance,
  modeledMethodSupportsInput,
} from "../../model-editor/modeled-method";
import type { Method } from "../../model-editor/method";
import type { QueryLanguage } from "../../common/query-language";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { InputDropdown } from "./InputDropdown";
import { ModelTypeTextbox } from "./ModelTypeTextbox";

type Props = {
  language: QueryLanguage;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelInputDropdown = ({
  language,
  method,
  modeledMethod,
  onChange,
}: Props): React.JSX.Element => {
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
        provenance: calculateNewProvenance(modeledMethod),
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
    return (
      <ModelTypeTextbox
        modeledMethod={modeledMethod}
        typeInfo="path"
        onChange={onChange}
        aria-label="Path"
      />
    );
  }

  return (
    <InputDropdown
      value={value}
      options={options}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Input"
    />
  );
};
