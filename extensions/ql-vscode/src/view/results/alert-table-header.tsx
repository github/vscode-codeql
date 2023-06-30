import * as React from "react";
import { useCallback } from "react";
import { vscode } from "../vscode-api";
import {
  InterpretedResultsSortColumn,
  InterpretedResultsSortState,
  SortDirection,
} from "../../common/interface-types";
import { nextSortDirection } from "./result-table-utils";

export function AlertTableHeader({
  sortState,
}: {
  sortState?: InterpretedResultsSortState;
}) {
  const sortClass = useCallback(
    (column: InterpretedResultsSortColumn): string => {
      if (sortState !== undefined && sortState.sortBy === column) {
        return sortState.sortDirection === SortDirection.asc
          ? "sort-asc"
          : "sort-desc";
      } else {
        return "sort-none";
      }
    },
    [sortState],
  );

  const getNextSortState = useCallback(
    (
      column: InterpretedResultsSortColumn,
    ): InterpretedResultsSortState | undefined => {
      const prevDirection =
        sortState && sortState.sortBy === column
          ? sortState.sortDirection
          : undefined;
      const nextDirection = nextSortDirection(prevDirection, true);
      return nextDirection === undefined
        ? undefined
        : { sortBy: column, sortDirection: nextDirection };
    },
    [sortState],
  );

  const toggleSortStateForColumn = useCallback(
    (column: InterpretedResultsSortColumn): void => {
      vscode.postMessage({
        t: "changeInterpretedSort",
        sortState: getNextSortState(column),
      });
    },
    [getNextSortState],
  );

  const clickCallback = useCallback(
    () => toggleSortStateForColumn("alert-message"),
    [toggleSortStateForColumn],
  );

  return (
    <thead>
      <tr>
        <th colSpan={2}></th>
        <th
          className={`${sortClass(
            "alert-message",
          )} vscode-codeql__alert-message-cell`}
          colSpan={3}
          onClick={clickCallback}
        >
          Message
        </th>
      </tr>
    </thead>
  );
}
