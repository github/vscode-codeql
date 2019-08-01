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
export interface FivePartLocation {
  t: LocationStyle.FivePart;
  file: string;
  lineStart: number;
  colStart: number;
  lineEnd: number;
  colEnd: number;
}

export interface StringLocation {
  t: LocationStyle.String;
  loc: string;
}

export interface NoLocation {
  t: LocationStyle.No;
}

export type LocationValue = FivePartLocation | StringLocation | NoLocation;

/**
 * Determines whether the specified `LocationValue` can be resolved to an actual source file.
 * @param loc The location to test.
 */
export function isResolvableLocation(loc: LocationValue | undefined): loc is FivePartLocation {
  if (loc && (loc.t === LocationStyle.FivePart) && loc.file) {
    return true;
  }
  else {
    return false;
  }
}

export interface StringValue {
  t: 's';
  v: string;
}

export interface BooleanValue {
  t: 'b';
  v: boolean;
}

export interface IntValue {
  t: 'i';
  v: number;
}

export interface FloatValue {
  t: 'f';
  v: number;
}

export interface DateValue {
  t: 'd';
  v: Buffer;
}

export interface UrlValue {
  t: 'u';
  v: string;
}

export interface ElementValue {
  t: 'e';
  primitive: TupleValue;
  label?: string;
  loc: LocationValue;
}

export type TupleValue =
  | StringValue
  | BooleanValue
  | IntValue
  | FloatValue
  | DateValue
  | UrlValue
  | ElementValue;

export type PrimitiveType = 's' | 'b' | 'i' | 'f' | 'd' | 'u' | 'e';

export type ColumnType =
  | { primitiveType: PrimitiveType, locationStyle: LocationStyle, hasLabel: boolean }
  | string;

export type Tuple = TupleValue[];

export interface Column {
  name: string;
  t: ColumnType;
}

export interface ResultSet {
  version: number;
  name: string;
  numTuples: number;
  columns: Column[];
  results: Tuple[];
}

export interface ResultSets {
  header: {
    version: number,
    numberOfResultSets: number,
    stringPoolSize: number,
  };
  results: ResultSet[];
}
