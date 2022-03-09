export type AnalysisResultStatus = 'InProgress' | 'Completed' | 'Failed';

export interface AnalysisResults {
  nwo: string;
  status: AnalysisResultStatus;
  interpretedResults: AnalysisAlert[];
}

export interface AnalysisAlert {
  message: string;
  shortDescription: string;
  severity: ResultSeverity;
  filePath: string;
  codeSnippet: CodeSnippet;
  highlightedRegion: HighlightedRegion;
  codeFlows: CodeFlow[];
}

export interface CodeSnippet {
  startLine: number;
  endLine: number;
  text: string;
}

export interface HighlightedRegion {
  startLine: number;
  startColumn: number;
  endLine: number | undefined;
  endColumn: number;
}

export interface CodeFlow {
  threadFlows: ThreadFlow[];
}

export interface ThreadFlow {
  filePath: string;
  codeSnippet: CodeSnippet;
  highlightedRegion: HighlightedRegion;
  message?: string;
}

export type ResultSeverity = 'Recommendation' | 'Warning' | 'Error';
