import * as React from "react";
import { useRef, useState } from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import { Overlay, ThemeProvider } from "@primer/react";

import {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../remote-queries/shared/analysis-result";
import { CodePathsOverlay } from "./CodePathsOverlay";

const ShowPathsLink = styled(VSCodeLink)`
  cursor: pointer;
`;

export type CodePathsProps = {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
};

export const CodePaths = ({
  codeFlows,
  ruleDescription,
  message,
  severity,
}: CodePathsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const linkRef = useRef<HTMLAnchorElement>(null);

  const closeOverlay = () => setIsOpen(false);

  return (
    <>
      <ShowPathsLink onClick={() => setIsOpen(true)} ref={linkRef}>
        Show paths
      </ShowPathsLink>
      {isOpen && (
        <ThemeProvider colorMode="auto">
          <Overlay
            returnFocusRef={linkRef}
            onEscape={closeOverlay}
            onClickOutside={closeOverlay}
            anchorSide="outside-top"
          >
            <CodePathsOverlay
              codeFlows={codeFlows}
              ruleDescription={ruleDescription}
              message={message}
              severity={severity}
              onClose={closeOverlay}
            />
          </Overlay>
        </ThemeProvider>
      )}
    </>
  );
};
