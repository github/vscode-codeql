import type {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "./analysis-result";

export interface DataFlowPaths {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
}
