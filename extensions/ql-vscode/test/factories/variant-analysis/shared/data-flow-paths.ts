import { CodeFlow } from "../../../../src/variant-analysis/shared/analysis-result";
import { DataFlowPaths } from "../../../../src/variant-analysis/shared/data-flow-paths";

export function createMockDataFlowPaths(): DataFlowPaths {
  const codeFlows: CodeFlow[] = [
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

  return {
    codeFlows,
    ruleDescription: "ZipSlip vulnerability",
    message: {
      tokens: [
        {
          t: "text",
          text: "This zip file may have a dangerous path",
        },
      ],
    },
    severity: "Warning",
  };
}
