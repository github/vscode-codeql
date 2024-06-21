/**
 * The single-character codes used in the bqrs format for the the kind
 * of a result column. This namespace is intentionally not an enum, see
 * the "for the sake of extensibility" comment in messages.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BqrsColumnKindCode {
  export const FLOAT = "f";
  export const INTEGER = "i";
  export const STRING = "s";
  export const BOOLEAN = "b";
  export const DATE = "d";
  export const ENTITY = "e";
  export const BIGINT = "z";
}

export type BqrsColumnKind =
  | typeof BqrsColumnKindCode.FLOAT
  | typeof BqrsColumnKindCode.INTEGER
  | typeof BqrsColumnKindCode.STRING
  | typeof BqrsColumnKindCode.BOOLEAN
  | typeof BqrsColumnKindCode.DATE
  | typeof BqrsColumnKindCode.ENTITY
  | typeof BqrsColumnKindCode.BIGINT;

export interface BqrsSchemaColumn {
  name?: string;
  kind: BqrsColumnKind;
}

export interface BqrsResultSetSchema {
  name: string;
  rows: number;
  columns: BqrsSchemaColumn[];
  pagination?: BqrsPaginationInfo;
}

interface BqrsPaginationInfo {
  "step-size": number;
  offsets: number[];
}

export interface BqrsInfo {
  "result-sets": BqrsResultSetSchema[];
}

export type BqrsId = number;

export interface BqrsEntityValue {
  url?: BqrsUrlValue;
  label?: string;
  id?: BqrsId;
}

export interface BqrsLineColumnLocation {
  uri: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface BqrsWholeFileLocation {
  uri: string;
  startLine: never;
  startColumn: never;
  endLine: never;
  endColumn: never;
}

export type BqrsUrlValue =
  | BqrsWholeFileLocation
  | BqrsLineColumnLocation
  | string;

export type BqrsCellValue = BqrsEntityValue | number | string | boolean;

export type BqrsKind =
  | "String"
  | "Float"
  | "Integer"
  | "Boolean"
  | "Date"
  | "Entity"
  | "BigInt";

interface BqrsColumn {
  name?: string;
  kind: BqrsKind;
}

export interface DecodedBqrsChunk {
  tuples: BqrsCellValue[][];
  next?: number;
  columns: BqrsColumn[];
}

export type DecodedBqrs = Record<string, DecodedBqrsChunk>;
