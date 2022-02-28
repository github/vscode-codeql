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
  contextRegion: ContextRegion
  codeRegion: CodeRegion
}

export interface ContextRegion {
  startLine: number;
  endLine: number;
  text: string;
}

export interface CodeRegion {
  startLine: number;
  startColumn: number;
  endColumn: number;
}

export type ResultSeverity = 'Recommendation' | 'Warning' | 'Error';
