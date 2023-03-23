import * as React from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { vscode } from "../../vscode-api";

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
  const onShowPathsClick = () => {
    vscode.postMessage({
      t: "showDataFlowPaths",
      dataFlowPaths: {
        codeFlows,
        ruleDescription,
        message,
        severity,
      },
    });
  };

  return (
    <>
      <ShowPathsLink onClick={onShowPathsClick}>Show paths</ShowPathsLink>
    </>
  );
};
