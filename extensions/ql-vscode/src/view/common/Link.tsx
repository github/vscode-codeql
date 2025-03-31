import { styled } from "styled-components";

export const Link = styled.a`
  background: transparent;
  box-sizing: border-box;
  color: var(--link-foreground);
  cursor: pointer;
  fill: currentcolor;
  font-family: var(--font-family);
  font-size: var(--type-ramp-base-font-size);
  line-height: var(--type-ramp-base-line-height);
  outline: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    border: 1px solid var(--vscode-focusBorder);
  }

  &:focus {
    border: 1px solid var(--vscode-focusBorder);
  }
`;
