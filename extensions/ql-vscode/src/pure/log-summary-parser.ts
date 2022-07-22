// TODO(angelapwen): Only load in necessary information and
// location in bytes for this log to save memory. 
export interface EvalLogData {
  predicateName: string;
  millis: number;
  resultSize: number;
  // Key: pipeline identifier; Value: array of pipeline steps 
  ra: Record<string, string[]>;
}

/**
 * A pure method that parses a string of evaluator log summaries into
 * an array of EvalLogData objects.
 *
 */
export function parseViewerData(logSummary: string): EvalLogData[] {
  // Remove newline delimiters because summary is in .jsonl format.
  const jsonSummaryObjects: string[] = logSummary.split(/\r?\n\r?\n/g);
  const viewerData: EvalLogData[] = [];

  for (const obj of jsonSummaryObjects) {
    const jsonObj = JSON.parse(obj);

    // Only convert log items that have an RA and millis field
    if (jsonObj.ra !== undefined && jsonObj.millis !== undefined) {
      const newLogData: EvalLogData = {
        predicateName: jsonObj.predicateName,
        millis: jsonObj.millis,
        resultSize: jsonObj.resultSize,
        ra: jsonObj.ra
      };
      viewerData.push(newLogData);
    }
  }
  return viewerData;
}
