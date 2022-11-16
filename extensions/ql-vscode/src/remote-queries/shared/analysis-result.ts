import { RawResultSet, ResultSetSchema } from "../../pure/bqrs-cli-types";

export type AnalysisResultStatus = "InProgress" | "Completed" | "Failed";

export interface AnalysisResults {
  nwo: string;
  status: AnalysisResultStatus;
  interpretedResults: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
  resultCount: number;
  starCount?: number;
  lastUpdated?: number;
}

export interface AnalysisRawResults {
  schema: ResultSetSchema;
  resultSet: RawResultSet;
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
  capped: boolean;
}

export interface AnalysisAlert {
  message: AnalysisMessage;
  shortDescription: string;
  severity: ResultSeverity;
  fileLink: FileLink;
  codeSnippet?: CodeSnippet;
  highlightedRegion?: HighlightedRegion;
  codeFlows: CodeFlow[];
}

export interface FileLink {
  fileLinkPrefix: string;
  filePath: string;
}

export interface CodeSnippet {
  startLine: number;
  endLine: number;
  text: string;
}

export interface HighlightedRegion {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CodeFlow {
  threadFlows: ThreadFlow[];
}

export interface ThreadFlow {
  fileLink: FileLink;
  codeSnippet: CodeSnippet;
  highlightedRegion?: HighlightedRegion;
  message?: AnalysisMessage;
}

export interface AnalysisMessage {
  tokens: AnalysisMessageToken[];
}

export type AnalysisMessageToken =
  | AnalysisMessageTextToken
  | AnalysisMessageLocationToken;

export interface AnalysisMessageTextToken {
  t: "text";
  text: string;
}

export interface AnalysisMessageLocationToken {
  t: "location";
  text: string;
  location: {
    fileLink: FileLink;
    highlightedRegion?: HighlightedRegion;
  };
}

export type ResultSeverity = "Recommendation" | "Warning" | "Error";

/**
 * Returns the number of (raw + interpreted) results for an analysis.
 */
export const getAnalysisResultCount = (
  analysisResults: AnalysisResults,
): number => {
  const rawResultCount = analysisResults.rawResults?.resultSet.rows.length || 0;
  return analysisResults.interpretedResults.length + rawResultCount;
};

/**
 * Returns the total number of results for an analysis by adding all individual repo results.
 */
export const sumAnalysesResults = (analysesResults: AnalysisResults[]) =>
  analysesResults.reduce((acc, curr) => acc + getAnalysisResultCount(curr), 0);
