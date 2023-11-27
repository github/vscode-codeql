import {
  CellValue as BqrsCellValue,
  ColumnKind as BqrsColumnKind,
  ColumnKindCode,
  DecodedBqrsChunk,
  EntityValue as BqrsEntityValue,
  ResultSetSchema,
  UrlValue as BqrsUrlValue,
} from "./bqrs-cli-types";
import {
  CellValue,
  Column,
  ColumnKind,
  EntityValue,
  RawResultSet,
  Tuple,
  UrlValue,
} from "./raw-result-types";
import { assertNever } from "./helpers-pure";

export function bqrsToResultSet(
  schema: ResultSetSchema,
  chunk: DecodedBqrsChunk,
): RawResultSet {
  const name = schema.name;
  const rows = schema.rows;
  const nextPageOffset = chunk.next;

  const columns = schema.columns.map(
    (column): Column => ({
      kind: mapColumnKind(column.kind),
      name: column.name,
    }),
  );

  const tuples = chunk.tuples.map(
    (tuple): Tuple => tuple.map((cell): CellValue => mapCellValue(cell)),
  );

  return {
    name,
    rows,
    columns,
    tuples,
    nextPageOffset,
  };
}

function mapColumnKind(kind: BqrsColumnKind): ColumnKind {
  switch (kind) {
    case ColumnKindCode.STRING:
      return ColumnKind.String;
    case ColumnKindCode.FLOAT:
      return ColumnKind.Float;
    case ColumnKindCode.INTEGER:
      return ColumnKind.Integer;
    case ColumnKindCode.BOOLEAN:
      return ColumnKind.Boolean;
    case ColumnKindCode.DATE:
      return ColumnKind.Date;
    case ColumnKindCode.ENTITY:
      return ColumnKind.Entity;
    default:
      assertNever(kind);
  }
}

function mapCellValue(cellValue: BqrsCellValue): CellValue {
  switch (typeof cellValue) {
    case "string":
      return {
        type: "string",
        value: cellValue,
      };
    case "number":
      return {
        type: "number",
        value: cellValue,
      };
    case "boolean":
      return {
        type: "boolean",
        value: cellValue,
      };
    case "object":
      return {
        type: "entity",
        value: mapEntityValue(cellValue),
      };
  }
}

function mapEntityValue(cellValue: BqrsEntityValue): EntityValue {
  return {
    url: cellValue.url === undefined ? undefined : mapUrlValue(cellValue.url),
    label: cellValue.label,
    id: cellValue.id,
  };
}

function mapUrlValue(urlValue: BqrsUrlValue): UrlValue {
  if (typeof urlValue === "string") {
    return {
      type: "string",
      value: urlValue,
    };
  }

  if (urlValue.startLine) {
    return {
      type: "lineColumnLocation",
      uri: urlValue.uri,
      startLine: urlValue.startLine,
      startColumn: urlValue.startColumn,
      endLine: urlValue.endLine,
      endColumn: urlValue.endColumn,
    };
  }

  return {
    type: "wholeFileLocation",
    uri: urlValue.uri,
  };
}
