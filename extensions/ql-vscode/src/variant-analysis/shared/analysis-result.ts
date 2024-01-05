import type { RawResultSet } from "../../common/raw-result-types";

export interface AnalysisRawResults {
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
  codeSnippet?: CodeSnippet;
  highlightedRegion?: HighlightedRegion;
  message?: AnalysisMessage;
}

export interface AnalysisMessage {
  tokens: AnalysisMessageToken[];
}

export type AnalysisMessageToken =
  | AnalysisMessageTextToken
  | AnalysisMessageLocationToken;

interface AnalysisMessageTextToken {
  t: "text";
  text: string;
}

export interface AnalysisMessageLocationToken {
  t: "location";
  text: string;
  location: AnalysisMessageLocationTokenLocation;
}

export interface AnalysisMessageLocationTokenLocation {
  fileLink: FileLink;
  highlightedRegion?: HighlightedRegion;
}

export type ResultSeverity = "Recommendation" | "Warning" | "Error";
