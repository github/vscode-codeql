import * as React from "react";
import { useRef, useState } from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import { Overlay, ThemeProvider } from "@primer/react";

import {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { CodePathsOverlay } from "./CodePathsOverlay";
import { useTelemetryOnChange } from "../telemetry";

const ShowPathsLink = styled(VSCodeLink)`
  cursor: pointer;
`;

export type CodePathsProps = {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
};

const filterIsOpenTelemetry = (v: boolean) => v;

export const CodePaths = ({
  codeFlows,
  ruleDescription,
  message,
  severity,
}: CodePathsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  useTelemetryOnChange(isOpen, "code-path-is-open", {
    filterTelemetryOnValue: filterIsOpenTelemetry,
  });

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
