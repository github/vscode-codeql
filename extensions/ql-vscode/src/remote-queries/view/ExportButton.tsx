import * as React from 'react';
import styled from 'styled-components';

const Button = styled.a`
  color: var(--vscode-button-foreground);
  background-color: var(--vscode-button-background);
  &:hover {
    color: var(--vscode-button-foreground);
    text-decoration: none;
    background-color: var(--vscode-button-hoverBackground);
  }
  cursor: pointer;
  padding: 5px 10px;
`;

const ExportButton = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <Button className="monaco-button monaco-text-button" onClick={onClick}>
    {text}
  </Button>
);

export default ExportButton;
