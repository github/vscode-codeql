import type {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { ThreadPath } from "./ThreadPath";

type CodePathProps = {
  codeFlow: CodeFlow;
  message: AnalysisMessage;
  severity: ResultSeverity;
};

export const CodePath = ({ codeFlow, message, severity }: CodePathProps) => (
  <>
    {codeFlow.threadFlows.map((threadFlow, index) => (
      <ThreadPath
        key={index}
        threadFlow={threadFlow}
        step={index + 1}
        message={message}
        severity={severity}
        isSource={index === 0}
        isSink={index === codeFlow.threadFlows.length - 1}
      />
    ))}
  </>
);
