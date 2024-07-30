import { useCallback } from "react";
import { vscode } from "../vscode-api";
import type { InterpretedResultsSortState } from "../../common/interface-types";
import { SortDirection } from "../../common/interface-types";
import { nextSortDirection } from "./result-table-utils";

export function AlertTableHeader({
  sortState,
}: {
  sortState?: InterpretedResultsSortState;
}) {
  const sortClass = useCallback((): string => {
    if (sortState?.sortBy === "alert-message") {
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
      sortState?.sortBy === "alert-message"
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

  return (
    <thead>
      <tr>
        <th colSpan={2}></th>
        <th
          className={`${sortClass()} vscode-codeql__alert-message-cell`}
          colSpan={4}
          onClick={toggleSortStateForColumn}
        >
          Message
        </th>
      </tr>
    </thead>
  );
}
