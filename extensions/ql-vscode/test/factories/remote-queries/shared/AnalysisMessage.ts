import { AnalysisMessage } from "../../../../src/remote-queries/shared/analysis-result";

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
