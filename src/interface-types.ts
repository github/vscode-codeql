import { FivePartLocation, ResultSet } from './bqrs-types';

export interface PreviousExecution {
  queryName: string;
  time: string;
  databaseName: string;
  durationSeconds: number;
}

export interface ResultsViewState {
  results: ResultSet[] | undefined;
}

export interface IntoResultsViewMsg {
  t: 'setState';
  s: ResultsViewState;
};

export interface FromResultsViewMsg {
  t: 'viewSourceFile';
  loc: FivePartLocation;
};
