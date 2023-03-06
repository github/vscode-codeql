import { RawResultSet, ResultSetSchema } from "../../pure/bqrs-cli-types";

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
