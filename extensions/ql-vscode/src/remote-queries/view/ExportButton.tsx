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
  padding: 5px 10px;
  border: 0;
`;

const ExportButton = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <Button onClick={onClick}>
    {text}
  </Button>
);

export default ExportButton;
