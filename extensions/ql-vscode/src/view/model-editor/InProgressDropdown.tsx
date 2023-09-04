import * as React from "react";
import { Dropdown } from "../common/Dropdown";

export const InProgressDropdown = () => {
  const noop = () => {
    // Do nothing
  };

  return (
    <Dropdown
      value="Thinking..."
      options={[]}
      disabled={true}
      disabledPlaceholder="Thinking..."
      onChange={noop}
    />
  );
};
