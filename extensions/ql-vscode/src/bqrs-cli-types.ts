
export const PAGE_SIZE = 1000;

export type ColumnKind = "f" | "i" | "s" | "b" | "d" | "e";

export interface Column {
  name?: string,
  kind: ColumnKind,
}


export interface ResultSetSchema {
  name: string,
  rows: number,
  columns: Column[],
  pagination?: PaginationInfo,
}

export function getResultSetSchema(resultSetName: string, resultSets: BQRSInfo): ResultSetSchema | undefined {
  for (const schema of resultSets["result-sets"]) {
    if (schema.name === resultSetName) {
      return schema;
    }
  }
  return undefined;
}
export interface PaginationInfo {
  "step-size": number,
  offsets: number[],
}

export interface BQRSInfo {
  "result-sets": ResultSetSchema[]
}

export interface EntityValue {
  url?: UrlValue,
  label?: string
}

export interface LineColumnLocation {
  uri: string
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  charOffset: never
  charLength: never
}

export interface OffsetLengthLocation {
  uri: string,
  startLine: never,
  startColumn: never,
  endLine: never,
  endColumn: never,
  charOffset: number,
  charLength: number,
}

export interface WholeFileLocation {
    uri: string,
    startLine: undefined,
    startColumn: undefined,
    endLine: undefined,
    endColumn: undefined,
    charOffset: undefined,
    charLength: undefined,
}

export type UrlValue = LineColumnLocation | OffsetLengthLocation | WholeFileLocation | string;


export type ColumnValue = EntityValue | number | string | boolean;

export interface DecodedBqrsChunk {
    tuples: ColumnValue[][],
    next?: number
}
