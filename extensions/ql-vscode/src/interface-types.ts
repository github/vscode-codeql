import { FivePartLocation, ResultSet } from './bqrs-types';

export interface DatabaseInfo {
  name: string;
  snapshotUri: string;
}

export interface PreviousExecution {
  queryName: string;
  time: string;
  databaseName: string;
  durationSeconds: number;
}

export interface IntoResultsViewMsg {
  t: 'setState';
  results: ResultSet[];
  database: DatabaseInfo;
};

export interface FromResultsViewMsg {
  t: 'viewSourceFile';
  loc: FivePartLocation;
  snapshotUri: string;
};
