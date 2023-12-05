/**
 * The single-character codes used in the bqrs format for the the kind
 * of a result column. This namespace is intentionally not an enum, see
 * the "for the sake of extensibility" comment in messages.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ColumnKindCode {
  export const FLOAT = "f";
  export const INTEGER = "i";
  export const STRING = "s";
  export const BOOLEAN = "b";
  export const DATE = "d";
  export const ENTITY = "e";
}

type ColumnKind =
  | typeof ColumnKindCode.FLOAT
  | typeof ColumnKindCode.INTEGER
  | typeof ColumnKindCode.STRING
  | typeof ColumnKindCode.BOOLEAN
  | typeof ColumnKindCode.DATE
  | typeof ColumnKindCode.ENTITY;

interface Column {
  name?: string;
  kind: ColumnKind;
}

export interface ResultSetSchema {
  name: string;
  rows: number;
  columns: Column[];
  pagination?: PaginationInfo;
}

export function getResultSetSchema(
  resultSetName: string,
  resultSets: BQRSInfo,
): ResultSetSchema | undefined {
  for (const schema of resultSets["result-sets"]) {
    if (schema.name === resultSetName) {
      return schema;
    }
  }
  return undefined;
}
interface PaginationInfo {
  "step-size": number;
  offsets: number[];
}

export interface BQRSInfo {
  "result-sets": ResultSetSchema[];
}

export type BqrsId = number;

export interface EntityValue {
  url?: UrlValue;
  label?: string;
  id?: BqrsId;
}

export interface LineColumnLocation {
  uri: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface WholeFileLocation {
  uri: string;
  startLine: never;
  startColumn: never;
  endLine: never;
  endColumn: never;
}

export type ResolvableLocationValue = WholeFileLocation | LineColumnLocation;

export type UrlValue = ResolvableLocationValue | string;

export type CellValue = EntityValue | number | string | boolean;

export type ResultRow = CellValue[];

export interface RawResultSet {
  readonly schema: ResultSetSchema;
  readonly rows: readonly ResultRow[];
}

// TODO: This function is not necessary. It generates a tuple that is slightly easier
// to handle than the ResultSetSchema and DecodedBqrsChunk. But perhaps it is unnecessary
// boilerplate.
export function transformBqrsResultSet(
  schema: ResultSetSchema,
  page: DecodedBqrsChunk,
): RawResultSet {
  return {
    schema,
    rows: Array.from(page.tuples),
  };
}

export type BqrsKind =
  | "String"
  | "Float"
  | "Integer"
  | "String"
  | "Boolean"
  | "Date"
  | "Entity";

export interface BqrsColumn {
  name?: string;
  kind: BqrsKind;
}
export interface DecodedBqrsChunk {
  tuples: CellValue[][];
  next?: number;
  columns: BqrsColumn[];
}

export type DecodedBqrs = Record<string, DecodedBqrsChunk>;
