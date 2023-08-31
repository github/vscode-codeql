import * as React from "react";
import { Dropdown } from "../common/Dropdown";

export const InProgressDropdown = () => {
  const options: Array<{ label: string; value: string }> = [
    {
      label: "Thinking...",
      value: "Thinking...",
    },
  ];
  const noop = () => {
    // Do nothing
  };

  return (
    <Dropdown
      value="Thinking..."
      options={options}
      disabled={false}
      onChange={noop}
    />
  );
};
