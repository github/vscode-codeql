import { FivePartLocation, ResultSet } from './bqrs-types';

export type PreviousExecution = {
  queryName: string,
  time: string,
  databaseName: string,
  durationSeconds: number,
}

export type ResultsViewState = {
  results: ResultSet[] | undefined,
}

export type IntoResultsViewMsg =
  { t: 'setState', s: ResultsViewState };

export type FromResultsViewMsg =
  { t: 'viewSourceFile', loc: FivePartLocation };
