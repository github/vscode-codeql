import type { CodeFlow } from "../../../../src/variant-analysis/shared/analysis-result";
import { createMockAnalysisMessage } from "./AnalysisMessage";

export function createMockCodeFlows(): CodeFlow[] {
  return [
    {
      threadFlows: [
        {
          fileLink: {
            fileLinkPrefix: "/prefix",
            filePath: "filePath",
          },
          codeSnippet: {
            startLine: 123,
            endLine: 456,
            text: "Code snippet text",
          },
          message: createMockAnalysisMessage(),
        },
      ],
    },
  ];
}
