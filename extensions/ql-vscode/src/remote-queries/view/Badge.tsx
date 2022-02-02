import * as React from 'react';
import styled from 'styled-components';

const BadgeContainer = styled.span`
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding-left: 0.2em;
`;

const BadgeText = styled.span`
  display: inline-block;
  min-width: 1.5em;
  padding: 0.3em;
  border-radius: 35%;
  font-size: x-small;
  text-align: center;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-color: var(--vscode-badge-background);
`;

const Badge = ({ text }: { text: string }) => (
  <BadgeContainer>
    <BadgeText>{text}</BadgeText>
  </BadgeContainer>
);

export default Badge;
