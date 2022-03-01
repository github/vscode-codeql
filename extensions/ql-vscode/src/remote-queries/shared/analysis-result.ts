export type AnalysisResultStatus = 'InProgress' | 'Completed' | 'Failed';

export interface AnalysisResults {
  nwo: string;
  status: AnalysisResultStatus;
  results: AnalysisAlert[];
}

export interface AnalysisAlert {
  message: string;
  severity: ResultSeverity;
  filePath: string;
  codeSnippet: CodeSnippet
  highlightedRegion: HighlightedRegion
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

export type ResultSeverity = 'Recommendation' | 'Warning' | 'Error';
