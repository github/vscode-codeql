import { styled } from "styled-components";

export const Tag = styled.span`
  background-color: var(--vscode-badge-background);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 2px;
  color: var(--vscode-badge-foreground);
  padding: 2px 4px;
  text-transform: uppercase;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: 11px;
  line-height: 16px;
`;
