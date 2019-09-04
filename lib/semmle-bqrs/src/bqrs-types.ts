/**
 * bqrs-types.ts
 * -------------
 *
 * Types for Binary Query Result Set files.
 * See [[https://git.semmle.com/Semmle/code/tree/master/queryserver-client/src/com/semmle/api/result/BinaryQueryResultSets.java]].
 */

import { ColumnType } from './bqrs-schema';
import { LocationValue } from './bqrs-results';

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
  v: Date;
}

export interface UrlValue {
  t: 'u';
  v: string;
}

export interface ElementValue {
  t: 'e';
  primitive: TupleValue;
  label?: string;
  loc?: LocationValue;
}

export type TupleValue =
  | StringValue
  | BooleanValue
  | IntValue
  | FloatValue
  | DateValue
  | UrlValue
  | ElementValue;



export type Tuple = TupleValue[];

export interface Column {
  name: string;
  type: ColumnType;
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
