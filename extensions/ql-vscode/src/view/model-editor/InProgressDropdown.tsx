import * as React from "react";
import { Dropdown } from "../common/Dropdown";

export const InProgressDropdown = () => {
  return (
    <Dropdown
      value="Thinking..."
      options={[]}
      disabled={true}
      disabledPlaceholder="Thinking..."
      fontStyle="italic"
    />
  );
};
