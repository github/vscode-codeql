import * as React from "react";
import styled from "styled-components";

import {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../remote-queries/shared/analysis-result";
import { useStateWithTelemetry } from "../telemetry";
import { SectionTitle } from "../SectionTitle";
import { VerticalSpace } from "../VerticalSpace";
import { CodeFlowsDropdown } from "./CodeFlowsDropdown";
import { CodePath } from "./CodePath";

const StyledCloseButton = styled.button`
  position: absolute;
  top: 1em;
  right: 4em;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: none;
  }
`;

const OverlayContainer = styled.div`
  height: 100%;
  width: 100%;
  padding: 2em;
  position: fixed;
  top: 0;
  left: 0;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  overflow-y: scroll;
`;

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <StyledCloseButton onClick={onClick} tabIndex={-1}>
    <span className="codicon codicon-chrome-close" />
  </StyledCloseButton>
);

const PathsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const PathDetailsContainer = styled.div`
  padding: 0;
  border: 0;
`;

const PathDropdownContainer = styled.div`
  flex-grow: 1;
  padding: 0 0 0 0.2em;
  border: none;
`;

type CodePathsOverlayProps = {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
  onClose: () => void;
};

export const CodePathsOverlay = ({
  codeFlows,
  ruleDescription,
  message,
  severity,
  onClose,
}: CodePathsOverlayProps) => {
  const [selectedCodeFlow, setSelectedCodeFlow] = useStateWithTelemetry(
    codeFlows[0],
    "code-flow-selected",
  );

  return (
    <OverlayContainer>
      <CloseButton onClick={onClose} />

      <SectionTitle>{ruleDescription}</SectionTitle>
      <VerticalSpace size={2} />

      <PathsContainer>
        <PathDetailsContainer>
          {codeFlows.length} paths available:{" "}
          {selectedCodeFlow.threadFlows.length} steps in
        </PathDetailsContainer>
        <PathDropdownContainer>
          <CodeFlowsDropdown
            codeFlows={codeFlows}
            setSelectedCodeFlow={setSelectedCodeFlow}
          />
        </PathDropdownContainer>
      </PathsContainer>

      <VerticalSpace size={2} />
      <CodePath
        codeFlow={selectedCodeFlow}
        severity={severity}
        message={message}
      />
      <VerticalSpace size={3} />
    </OverlayContainer>
  );
};
