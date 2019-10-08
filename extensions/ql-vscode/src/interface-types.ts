import { FivePartLocation } from 'semmle-bqrs';

export interface SarifLocation {
  message?: {
    text: string
  };
  physicalLocation: {
    artifactLocation: {
      index: number,
      uri: string,
      uriBaseId: string,
    },
    region: {
      charLength: number,
      charOffset: number,
      endColumn: number,
      endLine: number,
      startColumn: number,
      startLine: number,
    }
  };
}

export interface SarifThreadFlow {
  locations: {
    executionOrder: number,
    location: SarifLocation
  }[];
}

export interface SarifCodeFlow {
  threadFlows: SarifThreadFlow[];
}

export interface SarifResult {
  message?: { text: string };
  codeFlows: SarifCodeFlow[];
  locations: SarifLocation[];
}

export interface SarifRun {
  results: SarifResult[];
}

export interface Sarif {
  '$schema': string;
  version: string;
  runs: SarifRun[];
}

export interface DatabaseInfo {
  name: string;
  databaseUri: string;
}

export interface PreviousExecution {
  queryName: string;
  time: string;
  databaseName: string;
  durationSeconds: number;
}

export interface IntoResultsViewMsg {
  t: 'setState';
  resultsPath: string;
  database: DatabaseInfo;
};

export interface FromResultsViewMsg {
  t: 'viewSourceFile';
  loc: FivePartLocation;
  databaseUri: string;
};
