import { styled } from "styled-components";

export const Link = styled.a`
  background: transparent;
  box-sizing: border-box;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  fill: currentcolor;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
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
