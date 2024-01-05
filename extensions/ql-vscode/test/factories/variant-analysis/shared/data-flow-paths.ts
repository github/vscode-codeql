import type {
  AnalysisMessage,
  CodeFlow,
  ResultSeverity,
} from "../../../../src/variant-analysis/shared/analysis-result";
import type { DataFlowPaths } from "../../../../src/variant-analysis/shared/data-flow-paths";

const defaultCodeFlows: CodeFlow[] = [
  {
    threadFlows: [
      {
        fileLink: {
          fileLinkPrefix:
            "https://github.com/PowerShell/PowerShell/blob/450d884668ca477c6581ce597958f021fac30bff",
          filePath:
            "src/System.Management.Automation/help/UpdatableHelpSystem.cs",
        },
        codeSnippet: {
          startLine: 1260,
          endLine: 1260,
          text: "                        string extractPath = Path.Combine(destination, entry.FullName);",
        },
        highlightedRegion: {
          startLine: 1260,
          startColumn: 72,
          endLine: 1260,
          endColumn: 86,
        },
        message: {
          tokens: [
            {
              t: "text",
              text: "access to property FullName : String",
            },
          ],
        },
      },
      {
        fileLink: {
          fileLinkPrefix:
            "https://github.com/PowerShell/PowerShell/blob/450d884668ca477c6581ce597958f021fac30bff",
          filePath:
            "src/System.Management.Automation/help/UpdatableHelpSystem.cs",
        },
        codeSnippet: {
          startLine: 1260,
          endLine: 1260,
          text: "                        string extractPath = Path.Combine(destination, entry.FullName);",
        },
        highlightedRegion: {
          startLine: 1260,
          startColumn: 46,
          endLine: 1260,
          endColumn: 87,
        },
        message: {
          tokens: [
            {
              t: "text",
              text: "call to method Combine : String",
            },
          ],
        },
      },
      {
        fileLink: {
          fileLinkPrefix:
            "https://github.com/PowerShell/PowerShell/blob/450d884668ca477c6581ce597958f021fac30bff",
          filePath:
            "src/System.Management.Automation/help/UpdatableHelpSystem.cs",
        },
        codeSnippet: {
          startLine: 1261,
          endLine: 1261,
          text: "                        entry.ExtractToFile(extractPath);",
        },
        highlightedRegion: {
          startLine: 1261,
          startColumn: 45,
          endLine: 1261,
          endColumn: 56,
        },
        message: {
          tokens: [
            {
              t: "text",
              text: "access to local variable extractPath",
            },
          ],
        },
      },
    ],
  },
];

const defaultMessage: AnalysisMessage = {
  tokens: [
    {
      t: "text",
      text: "This zip file may have a dangerous path",
    },
  ],
};

export function createMockDataFlowPaths({
  codeFlows = defaultCodeFlows,
  ruleDescription = "ZipSlip vulnerability",
  message = defaultMessage,
  severity = "Warning",
}: {
  codeFlows?: CodeFlow[];
  ruleDescription?: string;
  message?: AnalysisMessage;
  severity?: ResultSeverity;
} = {}): DataFlowPaths {
  return {
    codeFlows,
    ruleDescription,
    message,
    severity,
  };
}
