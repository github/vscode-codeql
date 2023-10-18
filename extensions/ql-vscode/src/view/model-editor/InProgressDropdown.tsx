import * as React from "react";
import { styled } from "styled-components";
import { Dropdown } from "../common/Dropdown";

const StyledDropdown = styled(Dropdown)`
  font-style: italic;
`;

export const InProgressDropdown = () => {
  return (
    <StyledDropdown
      value="Thinking..."
      options={[]}
      disabled={true}
      disabledPlaceholder="Thinking..."
    />
  );
};
