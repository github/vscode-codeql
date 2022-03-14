import * as sarif from 'sarif';
import { parseSarifPlainTextMessage, parseSarifRegion } from '../pure/sarif-utils';

import {
  AnalysisAlert,
  CodeFlow,
  AnalysisMessage,
  AnalysisMessageToken,
  ResultSeverity,
  ThreadFlow,
  CodeSnippet,
  HighlightedRegion
} from './shared/analysis-result';

const defaultSeverity = 'Warning';

export function extractAnalysisAlerts(
  sarifLog: sarif.Log
): {
  alerts: AnalysisAlert[],
  errors: string[]
} {
  const alerts: AnalysisAlert[] = [];
  const errors: string[] = [];

  for (const run of sarifLog.runs ?? []) {
    for (const result of run.results ?? []) {
      try {
        alerts.push(...extractResultAlerts(run, result));
      } catch (e) {
        errors.push(`Error when processing SARIF result: ${e}`);
        continue;
      }
    }
  }

  return { alerts, errors };
}

function extractResultAlerts(
  run: sarif.Run,
  result: sarif.Result
): AnalysisAlert[] {
  const alerts: AnalysisAlert[] = [];

  const message = getMessage(result);
  const rule = tryGetRule(run, result);
  const severity = tryGetSeverity(run, result, rule) || defaultSeverity;
  const codeFlows = getCodeFlows(result);
  const shortDescription = getShortDescription(rule, message!);

  for (const location of result.locations ?? []) {
    const physicalLocation = location.physicalLocation!;
    const filePath = physicalLocation.artifactLocation!.uri!;
    const codeSnippet = getCodeSnippet(physicalLocation.contextRegion!);
    const highlightedRegion = physicalLocation.region
      ? getHighlightedRegion(physicalLocation.region!)
      : undefined;

    const analysisAlert: AnalysisAlert = {
      message,
      shortDescription,
      filePath,
      severity,
      codeSnippet,
      highlightedRegion,
      codeFlows: codeFlows
    };

    alerts.push(analysisAlert);
  }

  return alerts;
}

function getShortDescription(
  rule: sarif.ReportingDescriptor | undefined,
  message: AnalysisMessage,
): string {
  if (rule?.shortDescription?.text) {
    return rule.shortDescription.text;
  }

  return message.tokens.map(token => token.text).join();
}

export function tryGetSeverity(
  sarifRun: sarif.Run,
  result: sarif.Result,
  rule: sarif.ReportingDescriptor | undefined
): ResultSeverity | undefined {
  if (!sarifRun || !result || !rule) {
    return undefined;
  }

  const severity = rule.properties?.['problem.severity'];
  if (!severity) {
    return undefined;
  }

  switch (severity.toLowerCase()) {
    case 'recommendation':
      return 'Recommendation';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
  }

  return undefined;
}

export function tryGetRule(
  sarifRun: sarif.Run,
  result: sarif.Result
): sarif.ReportingDescriptor | undefined {
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
    const rule = sarifRun.tool.driver.rules?.find(r => r.id === ruleId);
    if (rule) {
      return rule;
    }
  }

  const ruleIndex = resultRule.index;
  if (ruleIndex != undefined) {
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

function getCodeSnippet(region: sarif.Region): CodeSnippet {
  const text = region.snippet!.text!;
  const { startLine, endLine } = parseSarifRegion(region);

  return {
    startLine,
    endLine,
    text
  } as CodeSnippet;
}

function getHighlightedRegion(region: sarif.Region): HighlightedRegion {
  const { startLine, startColumn, endLine, endColumn } = parseSarifRegion(region);

  return {
    startLine,
    startColumn,
    endLine,
    endColumn
  };
}

function getCodeFlows(
  result: sarif.Result
): CodeFlow[] {
  const codeFlows = [];

  if (result.codeFlows) {
    for (const codeFlow of result.codeFlows) {
      const threadFlows = [];

      for (const threadFlow of codeFlow.threadFlows) {
        for (const threadFlowLocation of threadFlow.locations) {
          const physicalLocation = threadFlowLocation!.location!.physicalLocation!;
          const filePath = physicalLocation!.artifactLocation!.uri!;
          const codeSnippet = getCodeSnippet(physicalLocation.contextRegion!);
          const highlightedRegion = physicalLocation.region
            ? getHighlightedRegion(physicalLocation.region)
            : undefined;

          threadFlows.push({
            filePath,
            codeSnippet,
            highlightedRegion
          } as ThreadFlow);
        }
      }

      codeFlows.push({ threadFlows } as CodeFlow);
    }
  }

  return codeFlows;
}

function getMessage(result: sarif.Result): AnalysisMessage {
  const tokens: AnalysisMessageToken[] = [];

  const messageText = result.message!.text!;
  const messageParts = parseSarifPlainTextMessage(messageText);

  for (const messagePart of messageParts) {
    if (typeof messagePart === 'string') {
      tokens.push({ t: 'text', text: messagePart });
    } else {
      const relatedLocation = result.relatedLocations!.find(rl => rl.id === messagePart.dest);
      tokens.push({
        t: 'location',
        text: messagePart.text,
        location: {
          filePath: relatedLocation!.physicalLocation!.artifactLocation!.uri!,
          highlightedRegion: getHighlightedRegion(relatedLocation!.physicalLocation!.region!),
        }
      });
    }
  }

  return { tokens };
}
