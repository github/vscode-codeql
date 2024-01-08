import type {
  Log,
  PhysicalLocation,
  Region,
  ReportingDescriptor,
  Result,
  Run,
} from "sarif";
import type { SarifLink } from "../common/sarif-utils";
import {
  parseHighlightedLine,
  parseSarifPlainTextMessage,
  parseSarifRegion,
} from "../common/sarif-utils";

import type {
  AnalysisAlert,
  AnalysisMessage,
  AnalysisMessageLocationTokenLocation,
  AnalysisMessageToken,
  CodeFlow,
  CodeSnippet,
  HighlightedRegion,
  ResultSeverity,
  ThreadFlow,
} from "./shared/analysis-result";

// A line of more than 8k characters is probably generated.
const CODE_SNIPPET_LARGE_LINE_SIZE_LIMIT = 8192;
// If less than 1% of the line is highlighted, we consider it a small snippet.
const CODE_SNIPPET_HIGHLIGHTED_REGION_MINIMUM_RATIO = 0.01;

const defaultSeverity = "Warning";

export function extractAnalysisAlerts(
  sarifLog: Log,
  fileLinkPrefix: string,
): {
  alerts: AnalysisAlert[];
  errors: string[];
} {
  const alerts: AnalysisAlert[] = [];
  const errors: string[] = [];

  for (const run of sarifLog.runs ?? []) {
    for (const result of run.results ?? []) {
      try {
        alerts.push(...extractResultAlerts(run, result, fileLinkPrefix));
      } catch (e) {
        errors.push(`Error when processing SARIF result: ${e}`);
        continue;
      }
    }
  }

  return { alerts, errors };
}

function extractResultAlerts(
  run: Run,
  result: Result,
  fileLinkPrefix: string,
): AnalysisAlert[] {
  const alerts: AnalysisAlert[] = [];

  const message = getMessage(result, fileLinkPrefix);
  const rule = tryGetRule(run, result);
  const severity = tryGetSeverity(run, result, rule) || defaultSeverity;
  const codeFlows = getCodeFlows(result, fileLinkPrefix);
  const shortDescription = getShortDescription(rule, message!);

  for (const location of result.locations ?? []) {
    const physicalLocation = location.physicalLocation!;
    const filePath = physicalLocation.artifactLocation!.uri!;
    const codeSnippet = getCodeSnippet(
      physicalLocation.contextRegion,
      physicalLocation.region,
    );
    const highlightedRegion = physicalLocation.region
      ? getHighlightedRegion(physicalLocation.region)
      : undefined;

    const analysisAlert: AnalysisAlert = {
      message,
      shortDescription,
      fileLink: {
        fileLinkPrefix,
        filePath,
      },
      severity,
      codeSnippet,
      highlightedRegion,
      codeFlows,
    };

    alerts.push(analysisAlert);
  }

  return alerts;
}

function getShortDescription(
  rule: ReportingDescriptor | undefined,
  message: AnalysisMessage,
): string {
  if (rule?.shortDescription?.text) {
    return rule.shortDescription.text;
  }

  return message.tokens.map((token) => token.text).join("");
}

export function tryGetSeverity(
  sarifRun: Run,
  result: Result,
  rule: ReportingDescriptor | undefined,
): ResultSeverity | undefined {
  if (!sarifRun || !result || !rule) {
    return undefined;
  }

  const severity = rule.properties?.["problem.severity"];
  if (!severity) {
    return undefined;
  }

  switch (severity.toLowerCase()) {
    case "recommendation":
      return "Recommendation";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
  }

  return undefined;
}

export function tryGetRule(
  sarifRun: Run,
  result: Result,
): ReportingDescriptor | undefined {
  if (!sarifRun || !result) {
    return undefined;
  }

  const resultRule = result.rule;
  if (!resultRule) {
    return undefined;
  }

  // The rule can found in two places:
  // - Either in the run's tool driver tool component
  // - Or in the run's tool extensions tool component

  const ruleId = resultRule.id;
  if (ruleId) {
    const rule = sarifRun.tool.driver.rules?.find((r) => r.id === ruleId);
    if (rule) {
      return rule;
    }
  }

  const ruleIndex = resultRule.index;
  if (ruleIndex !== undefined) {
    const toolComponentIndex = result.rule?.toolComponent?.index;
    const toolExtensions = sarifRun.tool.extensions;
    if (toolComponentIndex !== undefined && toolExtensions !== undefined) {
      const toolComponent = toolExtensions[toolComponentIndex];
      if (toolComponent?.rules !== undefined) {
        return toolComponent.rules[ruleIndex];
      }
    }
  }

  // Couldn't find the rule.
  return undefined;
}

export function tryGetFilePath(
  physicalLocation: PhysicalLocation,
): string | undefined {
  const filePath = physicalLocation.artifactLocation?.uri;
  // We expect the location uri value to be a relative file path, with no scheme.
  // We only need to support output from CodeQL here, so we can be quite strict,
  // even though the SARIF spec supports many more types of URI.
  if (
    filePath === undefined ||
    filePath === "" ||
    filePath.startsWith("file:")
  ) {
    return undefined;
  }
  return filePath;
}

function getCodeSnippet(
  contextRegion?: Region,
  region?: Region,
): CodeSnippet | undefined {
  const actualRegion = contextRegion ?? region;

  if (!actualRegion) {
    return undefined;
  }

  const text = actualRegion.snippet?.text || "";
  const { startLine, endLine } = parseSarifRegion(actualRegion);

  if (
    contextRegion &&
    region &&
    text.length > CODE_SNIPPET_LARGE_LINE_SIZE_LIMIT
  ) {
    const code = text.split("\n");

    const highlightedRegion = parseSarifRegion(region);

    const highlightedLines = code.map((line, index) => {
      return parseHighlightedLine(line, startLine + index, highlightedRegion);
    });

    const highlightedCharactersCount = highlightedLines.reduce(
      (a, line) => a + line.highlightedSection.length,
      0,
    );

    const highlightedRatio = highlightedCharactersCount / text.length;

    if (highlightedRatio < CODE_SNIPPET_HIGHLIGHTED_REGION_MINIMUM_RATIO) {
      // If not enough is highlighted and the snippet is large, it's probably generated or bundled code and
      // we don't want to show it.
      return undefined;
    }
  }

  return {
    startLine,
    endLine,
    text,
  };
}

function getHighlightedRegion(region: Region): HighlightedRegion {
  const { startLine, startColumn, endLine, endColumn } =
    parseSarifRegion(region);

  return {
    startLine,
    startColumn,
    endLine,

    // parseSarifRegion currently shifts the end column by 1 to account
    // for the way vscode counts columns so we need to shift it back.
    endColumn: endColumn + 1,
  };
}

function getCodeFlows(result: Result, fileLinkPrefix: string): CodeFlow[] {
  const codeFlows = [];

  if (result.codeFlows) {
    for (const codeFlow of result.codeFlows) {
      const threadFlows: ThreadFlow[] = [];

      for (const threadFlow of codeFlow.threadFlows) {
        for (const threadFlowLocation of threadFlow.locations) {
          const physicalLocation =
            threadFlowLocation!.location!.physicalLocation!;
          const filePath = tryGetFilePath(physicalLocation);
          const codeSnippet = getCodeSnippet(
            physicalLocation.contextRegion,
            physicalLocation.region,
          );
          const highlightedRegion = physicalLocation.region
            ? getHighlightedRegion(physicalLocation.region)
            : undefined;

          if (filePath !== undefined) {
            threadFlows.push({
              fileLink: {
                fileLinkPrefix,
                filePath,
              },
              codeSnippet,
              highlightedRegion,
            });
          }
        }
      }

      codeFlows.push({ threadFlows } as CodeFlow);
    }
  }

  return codeFlows;
}

function getMessage(result: Result, fileLinkPrefix: string): AnalysisMessage {
  const tokens: AnalysisMessageToken[] = [];

  const messageText = result.message!.text!;
  const messageParts = parseSarifPlainTextMessage(messageText);

  for (const messagePart of messageParts) {
    if (typeof messagePart === "string") {
      tokens.push({ t: "text", text: messagePart });
    } else {
      const location = getRelatedLocation(messagePart, result, fileLinkPrefix);
      if (location === undefined) {
        tokens.push({ t: "text", text: messagePart.text });
      } else {
        tokens.push({
          t: "location",
          text: messagePart.text,
          location,
        });
      }
    }
  }

  return { tokens };
}

function getRelatedLocation(
  messagePart: SarifLink,
  result: Result,
  fileLinkPrefix: string,
): AnalysisMessageLocationTokenLocation | undefined {
  const relatedLocation = result.relatedLocations!.find(
    (rl) => rl.id === messagePart.dest,
  );
  if (
    relatedLocation === undefined ||
    relatedLocation.physicalLocation?.artifactLocation?.uri === undefined ||
    relatedLocation.physicalLocation?.artifactLocation?.uri?.startsWith(
      "file:",
    ) ||
    relatedLocation.physicalLocation?.region === undefined
  ) {
    return undefined;
  }
  return {
    fileLink: {
      fileLinkPrefix,
      filePath: relatedLocation.physicalLocation.artifactLocation.uri,
    },
    highlightedRegion: getHighlightedRegion(
      relatedLocation.physicalLocation.region,
    ),
  };
}
