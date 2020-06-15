
export const PAGE_SIZE = 1000;

/**
 * The single-character codes used in the bqrs format for the the kind
 * of a result column. This namespace is intentionally not an enum, see
 * the "for the sake of extensibility" comment in messages.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ColumnKindCode {
  export const FLOAT = 'f';
  export const INTEGER = 'i';
  export const STRING = 's';
  export const BOOLEAN = 'b';
  export const DATE = 'd';
  export const ENTITY = 'e';
}

export type ColumnKind =
  | typeof ColumnKindCode.FLOAT
  | typeof ColumnKindCode.INTEGER
  | typeof ColumnKindCode.STRING
  | typeof ColumnKindCode.BOOLEAN
  | typeof ColumnKindCode.DATE
  | typeof ColumnKindCode.ENTITY;

export interface Column {
  name?: string;
  kind: ColumnKind;
}

export interface ResultSetSchema {
  name: string;
  rows: number;
  columns: Column[];
  pagination?: PaginationInfo;
}

export function getResultSetSchema(resultSetName: string, resultSets: BQRSInfo): ResultSetSchema | undefined {
  for (const schema of resultSets['result-sets']) {
    if (schema.name === resultSetName) {
      return schema;
    }
  }
  return undefined;
}
export interface PaginationInfo {
  'step-size': number;
  offsets: number[];
}

export interface BQRSInfo {
  'result-sets': ResultSetSchema[];
}

export interface EntityValue {
  url?: UrlValue;
  label?: string;
}

export interface LineColumnLocation {
  uri: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  charOffset: never;
  charLength: never;
}

export interface OffsetLengthLocation {
  uri: string;
  startLine: never;
  startColumn: never;
  endLine: never;
  endColumn: never;
  charOffset: number;
  charLength: number;
}

export interface WholeFileLocation {
  uri: string;
  startLine: never;
  startColumn: never;
  endLine: never;
  endColumn: never;
  charOffset: never;
  charLength: never;
}

export type UrlValue = LineColumnLocation | OffsetLengthLocation | WholeFileLocation | string;


export type ColumnValue = EntityValue | number | string | boolean;

export interface DecodedBqrsChunk {
  tuples: ColumnValue[][];
  next?: number;
}
