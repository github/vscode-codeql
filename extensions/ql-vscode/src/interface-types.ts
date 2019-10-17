import { FivePartLocation } from 'semmle-bqrs';

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
