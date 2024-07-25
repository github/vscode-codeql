import { styled } from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import type {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { vscode } from "../../vscode-api";

const ShowPathsLink = styled(VSCodeLink)`
  cursor: pointer;
`;

const Label = styled.span`
  color: var(--vscode-descriptionForeground);
  margin-left: 10px;
`;

function getShortestPathLength(codeFlows: CodeFlow[]): number {
  const allPathLengths = codeFlows
    .map((codeFlow) => codeFlow.threadFlows.length)
    .flat();
  return Math.min(...allPathLengths);
}

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
      <Label>(Shortest: {getShortestPathLength(codeFlows)})</Label>
    </>
  );
};
