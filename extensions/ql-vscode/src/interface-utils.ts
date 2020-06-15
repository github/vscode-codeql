import { RawResultSet } from './adapt';
import { ResultSetSchema } from 'semmle-bqrs';
import { Interpretation } from './interface-types';

export const SELECT_TABLE_NAME = '#select';
export const ALERTS_TABLE_NAME = 'alerts';

export type RawTableResultSet = { t: 'RawResultSet' } & RawResultSet;
export type PathTableResultSet = { t: 'SarifResultSet'; readonly schema: ResultSetSchema; name: string } & Interpretation;

export type ResultSet =
  | RawTableResultSet
  | PathTableResultSet;

export function getDefaultResultSet(resultSets: readonly ResultSet[]): string {
  return getDefaultResultSetName(resultSets.map(resultSet => resultSet.schema.name));
}

export function getDefaultResultSetName(resultSetNames: readonly string[]): string {
  // Choose first available result set from the array
  return [ALERTS_TABLE_NAME, SELECT_TABLE_NAME, resultSetNames[0]].filter(resultSetName => resultSetNames.includes(resultSetName))[0];
}
