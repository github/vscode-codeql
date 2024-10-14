import type {
  BqrsCellValue as BqrsCellValue,
  BqrsColumnKind as BqrsColumnKind,
  DecodedBqrsChunk,
  BqrsEntityValue as BqrsEntityValue,
  BqrsLineColumnLocation,
  BqrsResultSetSchema,
  BqrsUrlValue as BqrsUrlValue,
  BqrsWholeFileLocation,
  BqrsSchemaColumn,
} from "./bqrs-cli-types";
import { BqrsColumnKindCode } from "./bqrs-cli-types";
import type {
  CellValue,
  Column,
  EntityValue,
  RawResultSet,
  Row,
  UrlValue,
  UrlValueResolvable,
} from "./raw-result-types";
import { ColumnKind } from "./raw-result-types";
import { assertNever } from "./helpers-pure";
import { isEmptyPath } from "./bqrs-utils";

export function bqrsToResultSet(
  schema: BqrsResultSetSchema,
  chunk: DecodedBqrsChunk,
): RawResultSet {
  const name = schema.name;
  const totalRowCount = schema.rows;

  const columns = schema.columns.map(mapColumn);

  const rows = chunk.tuples.map(
    (tuple): Row => tuple.map((cell): CellValue => mapCellValue(cell)),
  );

  const resultSet: RawResultSet = {
    name,
    totalRowCount,
    columns,
    rows,
  };

  if (chunk.next) {
    resultSet.nextPageOffset = chunk.next;
  }

  return resultSet;
}

function mapColumn(column: BqrsSchemaColumn): Column {
  const result: Column = {
    kind: mapColumnKind(column.kind),
  };

  if (column.name) {
    result.name = column.name;
  }

  return result;
}

function mapColumnKind(kind: BqrsColumnKind): ColumnKind {
  switch (kind) {
    case BqrsColumnKindCode.STRING:
      return ColumnKind.String;
    case BqrsColumnKindCode.FLOAT:
      return ColumnKind.Float;
    case BqrsColumnKindCode.INTEGER:
      return ColumnKind.Integer;
    case BqrsColumnKindCode.BOOLEAN:
      return ColumnKind.Boolean;
    case BqrsColumnKindCode.DATE:
      return ColumnKind.Date;
    case BqrsColumnKindCode.ENTITY:
      return ColumnKind.Entity;
    case BqrsColumnKindCode.BIGINT:
      return ColumnKind.BigInt;
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
  const result: EntityValue = {};

  if (cellValue.id) {
    result.id = cellValue.id;
  }
  if (cellValue.label) {
    result.label = cellValue.label;
  }
  if (cellValue.url) {
    result.url = mapUrlValue(cellValue.url);
  }

  return result;
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

function isLineColumnLoc(loc: BqrsUrlValue): loc is BqrsLineColumnLocation {
  return (
    typeof loc !== "string" &&
    !isEmptyPath(loc.uri) &&
    "startLine" in loc &&
    "startColumn" in loc &&
    "endLine" in loc &&
    "endColumn" in loc
  );
}

function isWholeFileLoc(loc: BqrsUrlValue): loc is BqrsWholeFileLocation {
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
