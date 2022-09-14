import styled from 'styled-components';

export const LinkButton = styled.button`
  /* Remove button styling */
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;

  text-decoration: none;
  padding-right: 1em;
  color: var(--vscode-textLink-foreground);
  border: 1px solid transparent;

  &:hover, &:active {
    color: var(--vscode-textLink-activeForeground);
    text-decoration: underline;
  }

  &:focus,
  &:focus-visible {
    border: 1px solid var(--vscode-focusBorder);
  }
`;
