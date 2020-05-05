import { DecodedBqrsChunk, ResultSetSchema, ColumnKind, Column, ColumnValue } from "./bqrs-cli-types";
import { LocationValue, ResultSetSchema as AdaptedSchema, ColumnSchema, ColumnType, LocationStyle } from 'semmle-bqrs';

// FIXME: This is a temporary bit of impedance matching to convert
// from the types provided by ./bqrs-cli-types, to the types used by
// the view layer.
//
// The reason that it is benign for now is that it is only used by
// feature-flag-guarded codepaths that won't be encountered by normal
// users. It is not yet guaranteed to produce correct output for raw
// results.
//
// Eventually, the view layer should be refactored to directly accept data
// of types coming from bqrs-cli-types, and this file can be deleted.

export type ResultRow = ResultValue[];

export interface ResultElement {
  label: string;
  location?: LocationValue;
}

export interface ResultUri {
  uri: string;
}

export type ResultValue = ResultElement | ResultUri | string;

export interface RawResultSet {
  readonly schema: AdaptedSchema;
  readonly rows: readonly ResultRow[];
}

function adaptKind(kind: ColumnKind): ColumnType {
  // XXX what about 'u'?
  if (kind == 'e') {
    return { type: 'e', primitiveType: 's', locationStyle: LocationStyle.FivePart, hasLabel: true }
  }
  else {
    return { type: kind };
  }
}

function adaptColumn(col: Column): ColumnSchema {
  return { name: col.name!, type: adaptKind(col.kind) };
}

export function adaptSchema(schema: ResultSetSchema): AdaptedSchema {
  return {
    columns: schema.columns.map(adaptColumn),
    name: schema.name,
    tupleCount: schema.rows,
    version: 0,
  }
}

export function adaptValue(val: ColumnValue): ResultValue {
  // XXX taking a lot of incorrect shortcuts here

  if (typeof val == 'string') {
    return val;
  }

  if (typeof val == 'number' || typeof val == 'boolean') {
    return val + '';
  }

  const url = val.url;

  if (typeof url == 'string') {
    return url;
  }

  if (url == undefined) {
    return 'none';
  }

  return {
    label: val.label || '',
    location: {
      t: LocationStyle.FivePart,
      lineStart: url.startLine,
      lineEnd: url.endLine,
      colStart: url.startColumn,
      colEnd: url.endColumn,
      // FIXME: This seems definitely wrong. Should we be using
      // something like the code in sarif-utils.ts?
      file: url.uri.replace(/file:/, ''),
    }
  }

}

export function adaptRow(row: ColumnValue[]): ResultRow {
  return row.map(adaptValue);
}

export function adaptBqrs(schema: AdaptedSchema, page: DecodedBqrsChunk): RawResultSet {
  return {
    schema,
    rows: page.tuples.map(adaptRow),
  }
}
