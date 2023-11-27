import {
  CellValue as BqrsCellValue,
  ColumnKind as BqrsColumnKind,
  ColumnKindCode,
  DecodedBqrsChunk,
  EntityValue as BqrsEntityValue,
  LineColumnLocation,
  ResultSetSchema,
  UrlValue as BqrsUrlValue,
  WholeFileLocation,
} from "./bqrs-cli-types";
import {
  CellValue,
  Column,
  ColumnKind,
  EntityValue,
  RawResultSet,
  Row,
  UrlValue,
  UrlValueResolvable,
} from "./raw-result-types";
import { assertNever } from "./helpers-pure";
import { isEmptyPath } from "./bqrs-utils";

export function bqrsToResultSet(
  schema: ResultSetSchema,
  chunk: DecodedBqrsChunk,
): RawResultSet {
  const name = schema.name;
  const totalRowCount = schema.rows;
  const nextPageOffset = chunk.next;

  const columns = schema.columns.map(
    (column): Column => ({
      kind: mapColumnKind(column.kind),
      name: column.name,
    }),
  );

  const rows = chunk.tuples.map(
    (tuple): Row => tuple.map((cell): CellValue => mapCellValue(cell)),
  );

  return {
    name,
    totalRowCount,
    columns,
    rows,
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

export function mapUrlValue(urlValue: BqrsUrlValue): UrlValue | undefined {
  if (typeof urlValue === "string") {
    const location = tryGetLocationFromString(urlValue);
    if (location !== undefined) {
      return location;
    }

    return {
      type: "string",
      value: urlValue,
    };
  }

  if (isWholeFileLoc(urlValue)) {
    return {
      type: "wholeFileLocation",
      uri: urlValue.uri,
    };
  }

  if (isLineColumnLoc(urlValue)) {
    return {
      type: "lineColumnLocation",
      uri: urlValue.uri,
      startLine: urlValue.startLine,
      startColumn: urlValue.startColumn,
      endLine: urlValue.endLine,
      endColumn: urlValue.endColumn,
    };
  }

  return undefined;
}

function isLineColumnLoc(loc: BqrsUrlValue): loc is LineColumnLocation {
  return (
    typeof loc !== "string" &&
    !isEmptyPath(loc.uri) &&
    "startLine" in loc &&
    "startColumn" in loc &&
    "endLine" in loc &&
    "endColumn" in loc
  );
}

function isWholeFileLoc(loc: BqrsUrlValue): loc is WholeFileLocation {
  return (
    typeof loc !== "string" && !isEmptyPath(loc.uri) && !isLineColumnLoc(loc)
  );
}

/**
 * The CodeQL filesystem libraries use this pattern in `getURL()` predicates
 * to describe the location of an entire filesystem resource.
 * Such locations appear as `StringLocation`s instead of `FivePartLocation`s.
 *
 * Folder resources also get similar URLs, but with the `folder` scheme.
 * They are deliberately ignored here, since there is no suitable location to show the user.
 */
const FILE_LOCATION_REGEX = /file:\/\/(.+):([0-9]+):([0-9]+):([0-9]+):([0-9]+)/;

function tryGetLocationFromString(loc: string): UrlValueResolvable | undefined {
  const matches = FILE_LOCATION_REGEX.exec(loc);
  if (matches && matches.length > 1 && matches[1]) {
    if (isWholeFileMatch(matches)) {
      return {
        type: "wholeFileLocation",
        uri: matches[1],
      };
    } else {
      return {
        type: "lineColumnLocation",
        uri: matches[1],
        startLine: Number(matches[2]),
        startColumn: Number(matches[3]),
        endLine: Number(matches[4]),
        endColumn: Number(matches[5]),
      };
    }
  }

  return undefined;
}

function isWholeFileMatch(matches: RegExpExecArray): boolean {
  return (
    matches[2] === "0" &&
    matches[3] === "0" &&
    matches[4] === "0" &&
    matches[5] === "0"
  );
}
