import { styled } from "styled-components";
import { Dropdown } from "../common/Dropdown";

export const InputDropdown = styled(Dropdown)<{ $accepted: boolean }>`
  font-style: ${(props) => (props.$accepted ? "normal" : "italic")};
`;
