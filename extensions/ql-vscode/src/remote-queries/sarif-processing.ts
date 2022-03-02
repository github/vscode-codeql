import * as sarif from 'sarif';

import { AnalysisAlert, ResultSeverity } from './shared/analysis-result';

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
      const message = result.message?.text;
      if (!message) {
        errors.push('No message found in the SARIF result');
        continue;
      }

      const severity = tryGetSeverity(run, result) || defaultSeverity;

      if (!result.locations) {
        errors.push('No locations found in the SARIF result');
        continue;
      }

      for (const location of result.locations) {
        const contextRegion = location.physicalLocation?.contextRegion;
        if (!contextRegion) {
          errors.push('No context region found in the SARIF result location');
          continue;
        }
        if (contextRegion.startLine === undefined) {
          errors.push('No start line set for a result context region');
          continue;
        }
        if (contextRegion.endLine === undefined) {
          errors.push('No end line set for a result context region');
          continue;
        }
        if (!contextRegion.snippet?.text) {
          errors.push('No text set for a result context region');
          continue;
        }

        const region = location.physicalLocation?.region;
        if (!region) {
          errors.push('No region found in the SARIF result location');
          continue;
        }
        if (region.startLine === undefined) {
          errors.push('No start line set for a result region');
          continue;
        }
        if (region.startColumn === undefined) {
          errors.push('No start column set for a result region');
          continue;
        }
        if (region.endColumn === undefined) {
          errors.push('No end column set for a result region');
          continue;
        }

        const filePath = location.physicalLocation?.artifactLocation?.uri;
        if (!filePath) {
          errors.push('No file path found in the SARIF result location');
          continue;
        }

        const analysisAlert = {
          message,
          filePath,
          severity,
          codeSnippet: {
            startLine: contextRegion.startLine,
            endLine: contextRegion.endLine,
            text: contextRegion.snippet.text
          },
          highlightedRegion: {
            startLine: region.startLine,
            startColumn: region.startColumn,
            endLine: region.endLine,
            endColumn: region.endColumn
          }
        };

        const validationErrors = getAlertValidationErrors(analysisAlert);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }

        alerts.push(analysisAlert);
      }
    }
  }

  return { alerts, errors };
}

export function tryGetSeverity(
  sarifRun: sarif.Run,
  result: sarif.Result
): ResultSeverity | undefined {
  if (!sarifRun || !result) {
    return undefined;
  }

  const rule = tryGetRule(sarifRun, result);
  if (!rule) {
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

function getAlertValidationErrors(alert: AnalysisAlert): string[] {
  const errors = [];

  if (alert.codeSnippet.startLine > alert.codeSnippet.endLine) {
    errors.push('The code snippet start line is greater than the end line');
  }

  const highlightedRegion = alert.highlightedRegion;
  if (highlightedRegion.endLine === highlightedRegion.startLine &&
    highlightedRegion.endColumn < highlightedRegion.startColumn) {
    errors.push('The highlighted region end column is greater than the start column');
  }

  return errors;
}
