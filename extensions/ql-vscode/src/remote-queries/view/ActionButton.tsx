import * as React from 'react';
import styled from 'styled-components';

const Button = styled.button`
  color: var(--vscode-button-foreground);
  background-color: var(--vscode-button-background);
  &:hover {
    text-decoration: none;
    background-color: var(--vscode-button-hoverBackground);
  }
  cursor: pointer;
  padding: 8px;
  border: 0;
`;

const ActionButton = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <Button onClick={onClick}>
    {text}
  </Button>
);

export default ActionButton;
