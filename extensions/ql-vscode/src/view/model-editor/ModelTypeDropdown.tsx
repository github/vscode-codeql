import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import type {
  ModeledMethod,
  ModeledMethodType,
} from "../../model-editor/modeled-method";
import { calculateNewProvenance } from "../../model-editor/modeled-method";
import type { Method } from "../../model-editor/method";
import { createEmptyModeledMethod } from "../../model-editor/modeled-method-empty";
import type { Mutable } from "../../common/mutable";
import { ReadonlyDropdown } from "../common/ReadonlyDropdown";
import type { QueryLanguage } from "../../common/query-language";
import type {
  ModelConfig,
  ModelsAsDataLanguagePredicates,
} from "../../model-editor/languages";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { InputDropdown } from "./InputDropdown";

type Props = {
  language: QueryLanguage;
  modelConfig: ModelConfig;
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

const typeLabels: Record<keyof ModelsAsDataLanguagePredicates, string> = {
  source: "Source",
  sink: "Sink",
  summary: "Flow summary",
  neutral: "Neutral",
  type: "Type",
};

type Option = { value: ModeledMethodType; label: string };

export const ModelTypeDropdown = ({
  language,
  modelConfig,
  method,
  modeledMethod,
  onChange,
}: Props): React.JSX.Element => {
  const options = useMemo(() => {
    const modelsAsDataLanguage = getModelsAsDataLanguage(language);

    const baseOptions: Option[] = [
      { value: "none", label: "Unmodeled" },
      ...Object.entries(modelsAsDataLanguage.predicates)
        .map(([predicateKey, predicate]): Option | null => {
          const type = predicateKey as keyof ModelsAsDataLanguagePredicates;

          if (
            predicate.supportedEndpointTypes &&
            !predicate.supportedEndpointTypes.includes(method.endpointType)
          ) {
            return null;
          }

          if (
            predicate.isHidden &&
            predicate.isHidden({ method, config: modelConfig })
          ) {
            return null;
          }

          return {
            value: type,
            label: typeLabels[type],
          };
        })
        .filter((option): option is Option => option !== null),
    ];

    return baseOptions;
  }, [language, modelConfig, method]);

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

  return (
    <InputDropdown
      value={modeledMethod?.type ?? "none"}
      options={options}
      onChange={handleChange}
      aria-label="Model type"
    />
  );
};
