import { styled } from "styled-components";
import { Dropdown } from "../common/Dropdown";

export const InputDropdown = styled(Dropdown)<{ $pending: boolean }>`
  font-style: ${(props) => (props.$pending ? "italic" : "normal")};
`;
