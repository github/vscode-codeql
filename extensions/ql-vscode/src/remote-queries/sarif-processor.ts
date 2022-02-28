import * as sarif from 'sarif';

import { AnalysisAlert, ResultSeverity } from './shared/analysis-result';

export class ProcessedSarif {
  public constructor(
    public readonly alerts: AnalysisAlert[],
    public readonly errors: string[]) { }
}

export function processSarif(sarifLog: sarif.Log): ProcessedSarif {
  if (!sarifLog) {
    return new ProcessedSarif([], ['No SARIF log was found']);
  }

  if (!sarifLog.runs) {
    return new ProcessedSarif([], ['No runs found in the SARIF file']);
  }

  const errors = [];
  const alerts = [];

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

      const severity = getSeverity(run, result);

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

        const codeRegion = location.physicalLocation?.region;
        if (!codeRegion) {
          errors.push('No code region found in the SARIF result location');
          continue;
        }
        if (codeRegion.startLine === undefined) {
          errors.push('No start line set for a result code region');
          continue;
        }
        if (codeRegion.startColumn === undefined) {
          errors.push('No start column set for a result code region');
          continue;
        }
        if (codeRegion.endColumn === undefined) {
          errors.push('No end column set for a result code region');
          continue;
        }

        const filePath = location.physicalLocation?.artifactLocation?.uri;
        if (!filePath) {
          errors.push('No file path found in the SARIF result location');
          continue;
        }

        alerts.push({
          message,
          filePath,
          severity,
          contextRegion: {
            startLine: contextRegion.startLine,
            endLine: contextRegion.endLine,
            text: contextRegion.snippet.text
          },
          codeRegion: {
            startLine: codeRegion.startLine,
            startColumn: codeRegion.startColumn,
            endColumn: codeRegion.endColumn
          }
        });
      }
    }
  }

  return new ProcessedSarif(alerts, errors);
}

function getSeverity(sarifRun: sarif.Run, result: sarif.Result): ResultSeverity {
  const defaultSeverity = 'Warning';

  const ruleId = result.ruleId;
  if (!ruleId) {
    return defaultSeverity;
  }

  const rule = sarifRun.tool.driver.rules?.find(r => r.id === ruleId);
  if (!rule) {
    return defaultSeverity;
  }

  const severity = rule.properties?.['problem.severity'];
  if (!severity) {
    return defaultSeverity;
  }

  switch (severity.toLowerCase()) {
    case 'recommendation':
      return 'Recommendation';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
  }

  return defaultSeverity;
}
