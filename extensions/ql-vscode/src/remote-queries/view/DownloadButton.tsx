import * as React from 'react';
import * as octicons from '../../view/octicons';
import styled from 'styled-components';

const ButtonLink = styled.a`
  display: inline-block;
  font-size: x-small;
  text-decoration: none;
  cursor: pointer;
  vertical-align: middle;

  svg {
    fill: var(--vscode-textLink-foreground);
  }
`;

const DownloadButton = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <ButtonLink onClick={onClick}>
    {octicons.download}{text}
  </ButtonLink>
);

export default DownloadButton;
