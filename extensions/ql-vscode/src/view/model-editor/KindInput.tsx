import * as React from "react";
import { ChangeEvent, useCallback, useEffect, useMemo } from "react";
import type { ModeledMethodKind } from "../../model-editor/modeled-method";
import { Dropdown } from "../common/Dropdown";

type Props = {
  kinds: ModeledMethodKind[];

  value: ModeledMethodKind | undefined;
  disabled?: boolean;
  onChange: (value: ModeledMethodKind) => void;

  "aria-label"?: string;
};

export const KindInput = ({
  kinds,
  value,
  disabled,
  onChange,
  ...props
}: Props) => {
  const options = useMemo(
    () => kinds.map((kind) => ({ value: kind, label: kind })),
    [kinds],
  );

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const target = e.target as HTMLSelectElement;

      onChange(target.value as ModeledMethodKind);
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
      {...props}
    />
  );
};
