import { styled } from "styled-components";

const InfoBoxDiv = styled.div`
  max-width: 100em;
  padding: 0.5em 1em;
  border: 1px solid var(--vscode-widget-border);
  box-shadow: var(--vscode-widget-shadow) 0px 3px 8px;
  display: flex;
`;

interface InfoBoxProps {
  children: React.ReactNode;
}

export function InfoBox(props: InfoBoxProps) {
  return (
    <InfoBoxDiv>
      <p>{props.children}</p>
    </InfoBoxDiv>
  );
}
