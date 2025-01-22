import { styled } from "styled-components";
import { WarningIcon } from "./icon/WarningIcon";

const WarningBoxDiv = styled.div`
  max-width: 100em;
  padding: 0.5em 1em;
  border: 1px solid var(--vscode-widget-border);
  box-shadow: var(--vscode-widget-shadow) 0px 3px 8px;
  display: flex;
`;

const IconPane = styled.p`
  width: 3em;
  flex-shrink: 0;
  text-align: center;
`;

export interface WarningBoxProps {
  children: React.ReactNode;
}

export function WarningBox(props: WarningBoxProps) {
  return (
    <WarningBoxDiv>
      <IconPane>
        <WarningIcon />
      </IconPane>
      <p>{props.children}</p>
    </WarningBoxDiv>
  );
}
