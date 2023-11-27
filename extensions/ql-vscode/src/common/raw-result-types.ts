export enum ColumnKind {
  String = "string",
  Float = "float",
  Integer = "integer",
  Boolean = "boolean",
  Date = "date",
  Entity = "entity",
}

export type Column = {
  name?: string;
  kind: ColumnKind;
};

export type UrlValueString = {
  type: "string";
  value: string;
};

export type UrlValueWholeFileLocation = {
  type: "wholeFileLocation";
  uri: string;
};

export type UrlValueLineColumnLocation = {
  type: "lineColumnLocation";
  uri: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type UrlValueResolvable =
  | UrlValueWholeFileLocation
  | UrlValueLineColumnLocation;

export function isUrlValueResolvable(
  value: UrlValue,
): value is UrlValueResolvable {
  return (
    value.type === "wholeFileLocation" || value.type === "lineColumnLocation"
  );
}

export type UrlValue = UrlValueString | UrlValueResolvable;

export type EntityValue = {
  url?: UrlValue;
  label?: string;
  id?: number;
};

export type CellValueEntity = {
  type: "entity";
  value: EntityValue;
};

export type CellValueNumber = {
  type: "number";
  value: number;
};

export type CellValueString = {
  type: "string";
  value: string;
};

export type CellValueBoolean = {
  type: "boolean";
  value: boolean;
};

export type CellValue =
  | CellValueEntity
  | CellValueNumber
  | CellValueString
  | CellValueBoolean;

export type Row = CellValue[];

export type RawResultSet = {
  name: string;
  totalRowCount: number;

  columns: Column[];
  rows: Row[];

  nextPageOffset?: number;
};
