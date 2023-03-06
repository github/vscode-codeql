import { AnalysisMessage } from "../../../../src/variant-analysis/shared/analysis-result";

export function createMockAnalysisMessage(): AnalysisMessage {
  return {
    tokens: [
      {
        t: "text",
        text: "Token text",
      },
    ],
  };
}
