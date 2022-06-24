// REVIEW: Perhaps this file should be renamed now that it also includes the 
// data model on top of the parsing logic?

// REVIEW: Suggestions on other fields that are useful for a performance 
// debugger would be welcome!
export interface EvaluatorLogData {
    queryCausingWork: string;
    predicateName: string;
    millis: number;
    resultSize: number;
    ra?: Pipeline[];
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
    const jsonSummaryObjects: string[] = logSummary.split('\n\n');
    const visualizerData: EvaluatorLogData[] = [];
  
    for (const obj of jsonSummaryObjects) {
      const jsonObj = JSON.parse(obj);
  
      // Only convert log items that have an RA and millis field
      // REVIEW: Not sure this is exactly what we want. Are we now excluding too many items?
      // REVIEW: Is there a way to make this less brittle? 
      if (jsonObj.ra != undefined && jsonObj.millis != undefined) {
        const newLogData: EvaluatorLogData = {
          queryCausingWork: jsonObj.queryCausingWork,
          predicateName: jsonObj.predicateName,
          millis: jsonObj.millis,
          resultSize: jsonObj.resultSize
          // TODO: need to also parse RA, pipeline arrays into the object. 
        };
        visualizerData.push(newLogData);
      }
    } 
    return visualizerData;
}