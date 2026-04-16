import type {
  EditorSelection,
  QueryMetadata,
  RawResultsSortState,
  ResultSet,
  UserSettings,
} from "../../common/interface-types";
import { SortDirection } from "../../common/interface-types";
import { assertNever } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";
import type {
  CellValue,
  Row,
  UrlValueResolvable,
} from "../../common/raw-result-types";
import type { Result } from "sarif";
import {
  getLocationsFromSarifResult,
  normalizeFileUri,
} from "../../common/sarif-utils";

export interface ResultTableProps {
  resultSet: ResultSet;
  databaseUri: string;
  userSettings: UserSettings;
  metadata?: QueryMetadata;
  resultsPath: string | undefined;
  sortState?: RawResultsSortState;
  offset: number;

  /**
   * Holds if there are any raw results. When that is the case, we
   * want to direct users to pay attention to raw results if
   * interpreted results are empty.
   */
  nonemptyRawResults: boolean;

  /**
   * Callback to show raw results.
   */
  showRawResults: () => void;

  filteredRawRows?: Row[];
  filteredSarifResults?: Result[];
  selectionFilter?: EditorSelection;
}

export const className = "vscode-codeql__result-table";
export const tableHeaderClassName = "vscode-codeql__table-selection-header";
export const tableHeaderItemClassName =
  "vscode-codeql__table-selection-header-item";
export const alertExtrasClassName = `${className}-alert-extras`;
export const toggleDiagnosticsClassName = `${className}-toggle-diagnostics`;
const evenRowClassName = "vscode-codeql__result-table-row--even";
const oddRowClassName = "vscode-codeql__result-table-row--odd";
export const selectedRowClassName = "vscode-codeql__result-table-row--selected";

export function jumpToLocation(
  loc: UrlValueResolvable,
  databaseUri: string | undefined,
): void {
  vscode.postMessage({
    t: "viewSourceFile",
    loc,
    databaseUri,
  });
}

export function openFile(filePath: string): void {
  vscode.postMessage({
    t: "openFile",
    filePath,
  });
}

/**
 * Returns the attributes for a zebra-striped table row at position `index`.
 */
export function zebraStripe(
  index: number,
  ...otherClasses: string[]
): { className: string } {
  return {
    className: [
      index % 2 ? oddRowClassName : evenRowClassName,
      ...otherClasses,
    ].join(" "),
  };
}

/**
 * Returns the attributes for a zebra-striped table row at position `index`,
 * with highlighting if `isSelected` is true.
 */
export function selectableZebraStripe(
  isSelected: boolean,
  index: number,
  ...otherClasses: string[]
): { className: string } {
  return isSelected
    ? { className: [selectedRowClassName, ...otherClasses].join(" ") }
    : zebraStripe(index, ...otherClasses);
}

/**
 * Returns the next sort direction when cycling through sort directions while clicking.
 * if `includeUndefined` is true, include `undefined` in the cycle.
 */
export function nextSortDirection(
  direction: SortDirection | undefined,
  includeUndefined?: boolean,
): SortDirection | undefined {
  switch (direction) {
    case SortDirection.asc:
      return SortDirection.desc;
    case SortDirection.desc:
      return includeUndefined ? undefined : SortDirection.asc;
    case undefined:
      return SortDirection.asc;
    default:
      return assertNever(direction);
  }
}

/**
 * Extracts all resolvable locations from a raw result row.
 */
function getLocationsFromRawRow(
  row: Row,
): Array<{ uri: string; startLine?: number; endLine?: number }> {
  const locations: Array<{
    uri: string;
    startLine?: number;
    endLine?: number;
  }> = [];

  for (const cell of row) {
    const loc = getLocationFromCell(cell);
    if (loc) {
      locations.push(loc);
    }
  }

  return locations;
}

function getLocationFromCell(
  cell: CellValue,
): { uri: string; startLine?: number; endLine?: number } | undefined {
  if (cell.type !== "entity") {
    return undefined;
  }
  const url = cell.value.url;
  if (!url) {
    return undefined;
  }
  if (url.type === "wholeFileLocation") {
    return { uri: url.uri };
  }
  if (url.type === "lineColumnLocation") {
    return {
      uri: url.uri,
      startLine: url.startLine,
      endLine: url.endLine,
    };
  }
  return undefined;
}

/**
 * Checks if a result location overlaps with the editor selection.
 * If the selection is empty (just a cursor), matches any result in the same file.
 */
function doesLocationOverlapSelection(
  loc: { uri: string; startLine?: number; endLine?: number },
  selection: EditorSelection,
): boolean {
  const normalizedLocUri = normalizeFileUri(loc.uri);
  const normalizedSelUri = normalizeFileUri(selection.fileUri);

  if (normalizedLocUri !== normalizedSelUri) {
    return false;
  }

  // If selection is empty (just a cursor), match the whole file
  if (selection.isEmpty) {
    return true;
  }

  // If the result location has no line info, it's a whole-file location — include it
  if (loc.startLine === undefined) {
    return true;
  }

  // Only include results whose starting line falls within the selection range
  return (
    loc.startLine >= selection.startLine && loc.startLine <= selection.endLine
  );
}

/**
 * Filters raw result rows to those with at least one location overlapping the selection.
 */
export function filterRawRows(
  rows: readonly Row[],
  selection: EditorSelection,
): Row[] {
  return rows.filter((row) => {
    const locations = getLocationsFromRawRow(row);
    return locations.some((loc) =>
      doesLocationOverlapSelection(loc, selection),
    );
  });
}

/**
 * Filters SARIF results to those with at least one location overlapping the selection.
 */
export function filterSarifResults(
  results: Result[],
  sourceLocationPrefix: string,
  selection: EditorSelection,
): Result[] {
  return results.filter((result) => {
    const locations = getLocationsFromSarifResult(result, sourceLocationPrefix);
    return locations.some((loc) =>
      doesLocationOverlapSelection(loc, selection),
    );
  });
}
