import * as os from 'os';

// TODO(angelapwen): Only load in necessary information and
// location in bytes for this log to save memory. 
export interface EvaluatorLogData {
    queryCausingWork: string;
    predicateName: string;
    millis: number;
    resultSize: number;
    ra: Pipeline[];
}
  
interface Pipeline {
    // Key: pipeline identifier; Value: array of pipeline steps 
    pipeline: Map<string, string[]>;
}
  
/**
 * A pure method that parses a string of evaluator log summaries into
 * an array of EvaluatorLogData objects. 
 * 
 */
 export function parseVisualizerData(logSummary: string): EvaluatorLogData[] {
    // Remove newline delimiters because summary is in .jsonl format.
    const jsonSummaryObjects: string[] = logSummary.split(os.EOL + os.EOL);
    const visualizerData: EvaluatorLogData[] = [];
  
    for (const obj of jsonSummaryObjects) {
      const jsonObj = JSON.parse(obj);
  
      // Only convert log items that have an RA and millis field
      if (jsonObj.ra !== undefined && jsonObj.millis !== undefined) {
        const newLogData: EvaluatorLogData = {
          queryCausingWork: jsonObj.queryCausingWork,
          predicateName: jsonObj.predicateName,
          millis: jsonObj.millis,
          resultSize: jsonObj.resultSize,
          ra: jsonObj.ra
        };
        visualizerData.push(newLogData);
      }
    } 
    return visualizerData;
}