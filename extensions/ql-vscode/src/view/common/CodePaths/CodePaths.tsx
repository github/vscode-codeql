import * as React from "react";
import { useRef } from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import { Overlay, ThemeProvider } from "@primer/react";

import {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../remote-queries/shared/analysis-result";
import { CodePathsOverlay } from "./CodePathsOverlay";
import { useStateWithTelemetry } from "../telemetry";

const ShowPathsLink = styled(VSCodeLink)`
  cursor: pointer;
`;

export type CodePathsProps = {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
};

const filterIsOpenTelemetry = (v: boolean) => v === true;

export const CodePaths = ({
  codeFlows,
  ruleDescription,
  message,
  severity,
}: CodePathsProps) => {
  const [isOpen, setIsOpen] = useStateWithTelemetry<boolean>(
    false,
    "code-path-is-open",
    filterIsOpenTelemetry,
  );

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
