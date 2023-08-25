import * as React from "react";
import { ChangeEvent, useCallback, useEffect, useMemo } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { Dropdown } from "../common/Dropdown";

type Props = {
  kinds: Array<ModeledMethod["kind"]>;

  value: ModeledMethod["kind"] | undefined;
  disabled?: boolean;
  onChange: (value: ModeledMethod["kind"]) => void;
};

export const KindInput = ({ kinds, value, disabled, onChange }: Props) => {
  const options = useMemo(
    () => kinds.map((kind) => ({ value: kind, label: kind })),
    [kinds],
  );

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as ModeledMethod["kind"]);
    },
    [onChange],
  );

  useEffect(() => {
    if (value === undefined && kinds.length > 0) {
      onChange(kinds[0]);
    }

    if (value !== undefined && !kinds.includes(value)) {
      onChange(kinds[0]);
    }
  }, [value, kinds, onChange]);

  return (
    <Dropdown
      value={value}
      options={options}
      disabled={disabled}
      onChange={handleInput}
    />
  );
};
