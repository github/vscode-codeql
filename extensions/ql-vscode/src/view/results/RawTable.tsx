import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { className, jumpToLocation } from "./result-table-utils";
import type {
  RawResultsSortState,
  NavigateMsg,
} from "../../common/interface-types";
import {
  RAW_RESULTS_LIMIT,
  NavigationDirection,
} from "../../common/interface-types";
import RawTableHeader from "./RawTableHeader";
import RawTableRow from "./RawTableRow";
import { onNavigation } from "./navigation";
import { sendTelemetry } from "../common/telemetry";
import { assertNever } from "../../common/helpers-pure";
import { EmptyQueryResultsMessage } from "./EmptyQueryResultsMessage";
import { useScrollIntoView } from "./useScrollIntoView";
import type { RawResultSet } from "../../common/raw-result-types";
import { isUrlValueResolvable } from "../../common/raw-result-types";

type RawTableProps = {
  databaseUri: string;
  resultSet: RawResultSet;
  sortState?: RawResultsSortState;
  offset: number;
};

interface TableItem {
  readonly row: number;
  readonly column: number;
}

export function RawTable({
  databaseUri,
  resultSet,
  sortState,
  offset,
}: RawTableProps) {
  const [selectedItem, setSelectedItem] = useState<TableItem | undefined>();

  const selectedItemRef = useRef<HTMLTableCellElement>(null);
  useScrollIntoView(selectedItem, selectedItemRef);

  const setSelection = useCallback((row: number, column: number): void => {
    setSelectedItem({ row, column });
    sendTelemetry("local-results-raw-results-table-selected");
  }, []);

  const navigateWithDelta = useCallback(
    (rowDelta: number, columnDelta: number): void => {
      setSelectedItem((prevSelectedItem) => {
        const numberOfAlerts = resultSet.rows.length;
        if (numberOfAlerts === 0) {
          return prevSelectedItem;
        }
        const currentRow = prevSelectedItem?.row;
        const nextRow = currentRow === undefined ? 0 : currentRow + rowDelta;
        if (nextRow < 0 || nextRow >= numberOfAlerts) {
          return prevSelectedItem;
        }
        const currentColumn = prevSelectedItem?.column;
        const nextColumn =
          currentColumn === undefined ? 0 : currentColumn + columnDelta;
        // Jump to the location of the new cell
        const rowData = resultSet.rows[nextRow];
        if (nextColumn < 0 || nextColumn >= rowData.length) {
          return prevSelectedItem;
        }
        const cellData = rowData[nextColumn];
        if (
          cellData?.type === "entity" &&
          cellData.value.url &&
          isUrlValueResolvable(cellData.value.url)
        ) {
          jumpToLocation(cellData.value.url, databaseUri);
        }
        return { row: nextRow, column: nextColumn };
      });
    },
    [databaseUri, resultSet],
  );

  const handleNavigationEvent = useCallback(
    (event: NavigateMsg) => {
      switch (event.direction) {
        case NavigationDirection.up: {
          navigateWithDelta(-1, 0);
          break;
        }
        case NavigationDirection.down: {
          navigateWithDelta(1, 0);
          break;
        }
        case NavigationDirection.left: {
          navigateWithDelta(0, -1);
          break;
        }
        case NavigationDirection.right: {
          navigateWithDelta(0, 1);
          break;
        }
        default:
          assertNever(event.direction);
      }
    },
    [navigateWithDelta],
  );

  useEffect(() => {
    onNavigation.addListener(handleNavigationEvent);
    return () => {
      onNavigation.removeListener(handleNavigationEvent);
    };
  }, [handleNavigationEvent]);

  const [dataRows, numTruncatedResults] = useMemo(() => {
    if (resultSet.rows.length <= RAW_RESULTS_LIMIT) {
      return [resultSet.rows, 0];
    }
    return [
      resultSet.rows.slice(0, RAW_RESULTS_LIMIT),
      resultSet.rows.length - RAW_RESULTS_LIMIT,
    ];
  }, [resultSet]);

  if (dataRows.length === 0) {
    return <EmptyQueryResultsMessage />;
  }

  const tableRows = dataRows.map((row, rowIndex) => (
    <RawTableRow
      key={rowIndex}
      rowIndex={rowIndex + offset}
      row={row}
      databaseUri={databaseUri}
      selectedColumn={
        selectedItem?.row === rowIndex ? selectedItem?.column : undefined
      }
      onSelected={setSelection}
      selectedItemRef={selectedItemRef}
    />
  ));

  if (numTruncatedResults > 0) {
    const colSpan = dataRows[0].length + 1; // one row for each data column, plus index column
    tableRows.push(
      <tr>
        <td
          key={"message"}
          colSpan={colSpan}
          style={{ textAlign: "center", fontStyle: "italic" }}
        >
          Too many results to show at once. {numTruncatedResults} result(s)
          omitted.
        </td>
      </tr>,
    );
  }

  return (
    <table className={className}>
      <RawTableHeader
        columns={resultSet.columns}
        schemaName={resultSet.name}
        sortState={sortState}
      />
      <tbody>{tableRows}</tbody>
    </table>
  );
}
