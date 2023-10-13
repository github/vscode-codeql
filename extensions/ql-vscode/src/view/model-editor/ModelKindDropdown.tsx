import * as React from "react";
import { ChangeEvent, useCallback, useEffect, useMemo } from "react";
import type {
  ModeledMethod,
  ModeledMethodKind,
} from "../../model-editor/modeled-method";
import { Dropdown } from "../common/Dropdown";
import { Method } from "../../model-editor/method";
import { extensiblePredicateDefinitions } from "../../model-editor/predicates";

type Props = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelKindDropdown = ({
  method,
  modeledMethod,
  onChange,
}: Props) => {
  const predicate = useMemo(() => {
    return modeledMethod?.type && modeledMethod.type !== "none"
      ? extensiblePredicateDefinitions[modeledMethod.type]
      : undefined;
  }, [modeledMethod?.type]);

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
      if (!modeledMethod) {
        return;
      }

      onChange({
        ...modeledMethod,
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

  useEffect(() => {
    const value = modeledMethod?.kind;

    if (kinds.length === 0) {
      if (value !== "") {
        onChangeKind("");
      }

      return;
    }

    if (value === undefined) {
      onChangeKind(kinds[0]);
    }

    if (value !== undefined && !kinds.includes(value)) {
      onChangeKind(kinds[0]);
    }
  }, [modeledMethod?.kind, kinds, onChangeKind]);

  return (
    <Dropdown
      value={modeledMethod?.kind}
      options={options}
      disabled={disabled}
      onChange={handleChange}
      aria-label="Kind"
    />
  );
};
