import * as React from "react";
import { ChangeEvent, useCallback, useEffect, useMemo } from "react";
import {
  ModeledMethod,
  ModeledMethodKind,
  modeledMethodSupportsKind,
  isModelAccepted,
  calculateNewProvenance,
} from "../../model-editor/modeled-method";
import { getModelsAsDataLanguage } from "../../model-editor/languages";
import { QueryLanguage } from "../../common/query-language";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { InputDropdown } from "./InputDropdown";

type Props = {
  language: QueryLanguage;
  modeledMethod: ModeledMethod | undefined;
  modelingStatus: ModelingStatus;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelKindDropdown = ({
  language,
  modeledMethod,
  modelingStatus,
  onChange,
}: Props) => {
  const predicate = useMemo(() => {
    const modelsAsDataLanguage = getModelsAsDataLanguage(language);

    return modeledMethod?.type && modeledMethod.type !== "none"
      ? modelsAsDataLanguage.predicates[modeledMethod.type]
      : undefined;
  }, [language, modeledMethod?.type]);

  const kinds = useMemo(() => predicate?.supportedKinds || [], [predicate]);

  const disabled = useMemo(
    () => !predicate?.supportedKinds,
    [predicate?.supportedKinds],
  );

  const options = useMemo(
    () => kinds.map((kind) => ({ value: kind, label: kind })),
    [kinds],
  );

  const onChangeKind = useCallback(
    (kind: ModeledMethodKind) => {
      if (!modeledMethod || !modeledMethodSupportsKind(modeledMethod)) {
        return;
      }

      onChange({
        ...modeledMethod,
        provenance: calculateNewProvenance(modeledMethod),
        kind,
      });
    },
    [modeledMethod, onChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const target = e.target as HTMLSelectElement;
      const kind = target.value;

      onChangeKind(kind);
    },
    [onChangeKind],
  );

  const value =
    modeledMethod && modeledMethodSupportsKind(modeledMethod)
      ? modeledMethod.kind
      : undefined;

  useEffect(() => {
    if (!modeledMethod || !modeledMethodSupportsKind(modeledMethod)) {
      return;
    }

    if (kinds.length === 0 && value !== "") {
      onChangeKind("");
    } else if (kinds.length > 0 && !kinds.includes(value ?? "")) {
      onChangeKind(kinds[0]);
    }
  }, [modeledMethod, value, kinds, onChangeKind]);

  const modelAccepted = isModelAccepted(modeledMethod, modelingStatus);

  return (
    <InputDropdown
      value={value}
      options={options}
      disabled={disabled}
      $accepted={modelAccepted}
      onChange={handleChange}
      aria-label="Kind"
    />
  );
};
