import * as React from "react";
import styled from "styled-components";
import { DownloadIcon } from "@primer/octicons-react";

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

const DownloadButton = ({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) => (
  <ButtonLink onClick={onClick}>
    <DownloadIcon size={16} />
    {text}
  </ButtonLink>
);

export default DownloadButton;
