import * as sarif from 'sarif';
import { parseSarifPlainTextMessage } from '../pure/sarif-utils';

import {
  AnalysisAlert,
  CodeFlow,
  Location,
  AnalysisMessage,
  AnalysisMessageToken,
  ResultSeverity,
  ThreadFlow
} from './shared/analysis-result';

const defaultSeverity = 'Warning';

export function extractAnalysisAlerts(
  sarifLog: sarif.Log
): {
  alerts: AnalysisAlert[],
  errors: string[]
} {
  if (!sarifLog) {
    return { alerts: [], errors: ['No SARIF log was found'] };
  }

  if (!sarifLog.runs) {
    return { alerts: [], errors: ['No runs found in the SARIF file'] };
  }

  const errors: string[] = [];
  const alerts: AnalysisAlert[] = [];

  for (const run of sarifLog.runs) {
    if (!run.results) {
      errors.push('No results found in the SARIF run');
      continue;
    }

    for (const result of run.results) {
      if (!result.message?.text) {
        errors.push('No message found in the SARIF result');
        continue;
      }

      const { message, errors: messageErrors } = extractMessage(result.message?.text, result);
      if (messageErrors.length > 0) {
        errors.push(...messageErrors);
        continue;
      }

      const rule = tryGetRule(run, result);
      const severity = tryGetSeverity(run, result, rule) || defaultSeverity;

      const { codeFlows, errors: codeFlowsErrors } = extractCodeFlows(result);
      if (codeFlowsErrors.length > 0) {
        errors.push(...codeFlowsErrors);
        continue;
      }

      if (!result.locations) {
        errors.push('No locations found in the SARIF result');
        continue;
      }

      const shortDescription = getShortDescription(rule, message!);

      for (const location of result.locations) {
        const { processedLocation, errors: locationErrors } = extractLocation(location);

        if (locationErrors.length > 0) {
          errors.push(...locationErrors);
          continue;
        }

        const analysisAlert: AnalysisAlert = {
          message: message!,
          shortDescription,
          filePath: processedLocation!.filePath,
          severity,
          codeSnippet: processedLocation!.codeSnippet,
          highlightedRegion: processedLocation!.highlightedRegion,
          codeFlows: codeFlows
        };

        alerts.push(analysisAlert);
      }
    }
  }

  return { alerts, errors };
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

function validateContextRegion(contextRegion: sarif.Region | undefined): string[] {
  const errors: string[] = [];

  if (!contextRegion) {
    errors.push('No context region found in the SARIF result location');
    return errors;
  }
  if (contextRegion.startLine === undefined) {
    errors.push('No start line set for a result context region');
  }
  if (contextRegion.endLine === undefined) {
    errors.push('No end line set for a result context region');
  }
  if (!contextRegion.snippet?.text) {
    errors.push('No text set for a result context region');
  }

  if (errors.length > 0) {
    return errors;
  }

  if (contextRegion.startLine! > contextRegion.endLine!) {
    errors.push('Start line is greater than the end line in result context region');
  }

  return errors;
}

function validateRegion(region: sarif.Region | undefined): string[] {
  const errors: string[] = [];

  if (!region) {
    errors.push('No region found in the SARIF result location');
    return errors;
  }
  if (region.startLine === undefined) {
    errors.push('No start line set for a result region');
  }
  if (region.startColumn === undefined) {
    errors.push('No start column set for a result region');
  }
  if (region.endColumn === undefined) {
    errors.push('No end column set for a result region');
  }

  if (errors.length > 0) {
    return errors;
  }

  if (region.endLine! === region.startLine! &&
    region.endColumn! < region.startColumn!) {
    errors.push('End column is greater than the start column in a result region');
  }

  return errors;
}

function extractLocation(
  location: sarif.Location
): {
  processedLocation: Location | undefined,
  errors: string[]
} {
  const message = location.message?.text;

  const errors = [];

  const contextRegion = location.physicalLocation?.contextRegion;
  const contextRegionErrors = validateContextRegion(contextRegion);
  errors.push(...contextRegionErrors);

  const region = location.physicalLocation?.region;
  const regionErrors = validateRegion(region);
  errors.push(...regionErrors);

  const filePath = location.physicalLocation?.artifactLocation?.uri;
  if (!filePath) {
    errors.push('No file path found in the SARIF result location');
  }

  if (errors.length > 0) {
    return { processedLocation: undefined, errors };
  }

  const processedLocation = {
    message,
    filePath,
    codeSnippet: {
      startLine: contextRegion!.startLine,
      endLine: contextRegion!.endLine,
      text: contextRegion!.snippet!.text
    },
    highlightedRegion: {
      startLine: region!.startLine,
      startColumn: region!.startColumn,
      endLine: region!.endLine,
      endColumn: region!.endColumn
    }
  } as Location;

  return { processedLocation, errors: [] };
}

function extractCodeFlows(
  result: sarif.Result
): {
  codeFlows: CodeFlow[],
  errors: string[]
} {
  const codeFlows = [];
  const errors = [];

  if (result.codeFlows) {
    for (const codeFlow of result.codeFlows) {
      const threadFlows = [];

      for (const threadFlow of codeFlow.threadFlows) {
        for (const location of threadFlow.locations) {
          if (!location?.location) {
            errors.push('No location found in a SARIF thread flow');
          }
          const { processedLocation, errors: locationErrors } = extractLocation(location!.location!);
          if (locationErrors.length > 0) {
            errors.push(...locationErrors);
            continue;
          }

          threadFlows.push({
            filePath: processedLocation!.filePath,
            codeSnippet: processedLocation!.codeSnippet,
            highlightedRegion: processedLocation!.highlightedRegion,
            message: processedLocation!.message
          } as ThreadFlow);
        }
      }

      codeFlows.push({ threadFlows } as CodeFlow);
    }
  }

  return { errors, codeFlows: [] };
}

function extractMessage(
  messageText: string,
  result: sarif.Result
): {
  message: AnalysisMessage | undefined,
  errors: string[]
} {
  const tokens: AnalysisMessageToken[] = [];
  const errors: string[] = [];

  const messageParts = parseSarifPlainTextMessage(messageText);
  for (const messagePart of messageParts) {
    if (typeof messagePart === 'string') {
      tokens.push({ t: 'text', text: messagePart });
    } else {
      const relatedLocation = result.relatedLocations?.find(rl => rl.id === messagePart.dest);
      if (!relatedLocation) {
        errors.push(`Could not find related location with id ${messagePart.dest}`);
        continue;
      }

      const { processedLocation, errors: locationErrors } = extractLocation(relatedLocation);
      if (locationErrors.length > 0) {
        errors.push(...locationErrors);
        continue;
      }
      else {
        tokens.push({
          t: 'location',
          text: messagePart.text,
          location: processedLocation!
        });
      }
    }
  }

  return { message: { tokens }, errors };
}
