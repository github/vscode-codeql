import * as React from "react";
import { useCallback } from "react";
import { vscode } from "../vscode-api";
import {
  InterpretedResultsSortState,
  SortDirection,
} from "../../common/interface-types";
import { nextSortDirection } from "./result-table-utils";

export function AlertTableHeader({
  sortState,
}: {
  sortState?: InterpretedResultsSortState;
}) {
  const sortClass = useCallback((): string => {
    if (sortState !== undefined && sortState.sortBy === "alert-message") {
      return sortState.sortDirection === SortDirection.asc
        ? "sort-asc"
        : "sort-desc";
    } else {
      return "sort-none";
    }
  }, [sortState]);

  const getNextSortState = useCallback(():
    | InterpretedResultsSortState
    | undefined => {
    const prevDirection =
      sortState && sortState.sortBy === "alert-message"
        ? sortState.sortDirection
        : undefined;
    const nextDirection = nextSortDirection(prevDirection, true);
    return nextDirection === undefined
      ? undefined
      : { sortBy: "alert-message", sortDirection: nextDirection };
  }, [sortState]);

  const toggleSortStateForColumn = useCallback((): void => {
    vscode.postMessage({
      t: "changeInterpretedSort",
      sortState: getNextSortState(),
    });
  }, [getNextSortState]);

  const clickCallback = useCallback(
    () => toggleSortStateForColumn(),
    [toggleSortStateForColumn],
  );

  return (
    <thead>
      <tr>
        <th colSpan={2}></th>
        <th
          className={`${sortClass()} vscode-codeql__alert-message-cell`}
          colSpan={3}
          onClick={clickCallback}
        >
          Message
        </th>
      </tr>
    </thead>
  );
}
