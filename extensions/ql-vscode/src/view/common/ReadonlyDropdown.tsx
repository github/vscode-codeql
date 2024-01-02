import { useMemo } from "react";
import { Dropdown } from "./Dropdown";

type Props = {
  value: string;
  className?: string;

  "aria-label"?: string;
};

export function ReadonlyDropdown({ value, ...props }: Props) {
  const options = useMemo(() => {
    return [
      {
        value,
        label: value,
      },
    ];
  }, [value]);

  return (
    <Dropdown
      value={value}
      disabledPlaceholder={value}
      disabled={true}
      options={options}
      {...props}
    />
  );
}
