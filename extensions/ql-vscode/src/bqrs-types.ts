/**
 * bqrs-types.ts
 * -------------
 *
 * Types for Binary Query Result Set files.
 * See [[https://git.semmle.com/Semmle/code/tree/master/queryserver-client/src/com/semmle/api/result/BinaryQueryResultSets.java]].
 */

export type PoolString = string;

export enum LocationStyle {
  No = 0,
  String,
  FivePart,
}

// See https://help.semmle.com/QL/learn-ql/ql/locations.html for how these are used.
export type FivePartLocation =
  { file: string, lineStart: number, colStart: number, lineEnd: number, colEnd: number };

export type LocationValue =
  | { t: LocationStyle.No }
  | { t: LocationStyle.String, loc: string }
  | { t: LocationStyle.FivePart } & FivePartLocation

export type TupleValue =
  | { t: 's', v: string } // string
  | { t: 'b', v: boolean } // boolean
  | { t: 'i', v: number } // int
  | { t: 'f', v: number } // float
  | { t: 'd', v: Buffer } // FIXME: not implemented, but rarely used.
  | { t: 'u', v: string } // url
  | { t: 'e', primitive: TupleValue, label: string | undefined, loc: LocationValue } // location

export type ColumnType = { primitiveType: string, locationStyle: LocationStyle, hasLabel: boolean } | string

export type Tuple = TupleValue[];

export type Column = {
  name: string,
  t: ColumnType,
}

export type ResultSet = {
  version: number,
  name: string,
  numTuples: number,
  columns: Column[],
  results: Tuple[],
}

export type ResultSets = {
  header: {
    version: number,
    numberOfResultSets: number,
    stringPoolSize: number,
  },
  results: ResultSet[],
}
