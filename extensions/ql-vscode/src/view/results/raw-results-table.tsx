import * as React from "react";
import {
  ResultTableProps,
  className,
  emptyQueryResultsMessage,
  jumpToLocation,
} from "./result-table-utils";
import {
  RAW_RESULTS_LIMIT,
  RawResultsSortState,
  NavigateMsg,
  NavigationDirection,
  RawTableResultSet,
} from "../../common/interface-types";
import RawTableHeader from "./RawTableHeader";
import RawTableRow from "./RawTableRow";
import { ResultRow } from "../../common/bqrs-cli-types";
import { onNavigation } from "./results";
import { tryGetResolvableLocation } from "../../common/bqrs-utils";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";
import { sendTelemetry } from "../common/telemetry";

export type RawTableProps = ResultTableProps & {
  resultSet: RawTableResultSet;
  sortState?: RawResultsSortState;
  offset: number;
};

interface RawTableState {
  selectedItem?: { row: number; column: number };
}

export class RawTable extends React.Component<RawTableProps, RawTableState> {
  private scroller = new ScrollIntoViewHelper();

  constructor(props: RawTableProps) {
    super(props);
    this.setSelection = this.setSelection.bind(this);
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
    this.state = {};
  }

  private setSelection(row: number, column: number) {
    this.setState((prev) => ({
      ...prev,
      selectedItem: { row, column },
    }));
    sendTelemetry("local-results-raw-results-table-selected");
  }

  render(): React.ReactNode {
    const { resultSet, databaseUri } = this.props;

    let dataRows = resultSet.rows;
    if (dataRows.length === 0) {
      return emptyQueryResultsMessage();
    }

    let numTruncatedResults = 0;
    if (dataRows.length > RAW_RESULTS_LIMIT) {
      numTruncatedResults = dataRows.length - RAW_RESULTS_LIMIT;
      dataRows = dataRows.slice(0, RAW_RESULTS_LIMIT);
    }

    const tableRows = dataRows.map((row: ResultRow, rowIndex: number) => (
      <RawTableRow
        key={rowIndex}
        rowIndex={rowIndex + this.props.offset}
        row={row}
        databaseUri={databaseUri}
        selectedColumn={
          this.state.selectedItem?.row === rowIndex
            ? this.state.selectedItem?.column
            : undefined
        }
        onSelected={this.setSelection}
        scroller={this.scroller}
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
          columns={resultSet.schema.columns}
          schemaName={resultSet.schema.name}
          sortState={this.props.sortState}
        />
        <tbody>{tableRows}</tbody>
      </table>
    );
  }

  private handleNavigationEvent(event: NavigateMsg) {
    switch (event.direction) {
      case NavigationDirection.up: {
        this.navigateWithDelta(-1, 0);
        break;
      }
      case NavigationDirection.down: {
        this.navigateWithDelta(1, 0);
        break;
      }
      case NavigationDirection.left: {
        this.navigateWithDelta(0, -1);
        break;
      }
      case NavigationDirection.right: {
        this.navigateWithDelta(0, 1);
        break;
      }
    }
  }

  private navigateWithDelta(rowDelta: number, columnDelta: number) {
    this.setState((prevState) => {
      const numberOfAlerts = this.props.resultSet.rows.length;
      if (numberOfAlerts === 0) {
        return prevState;
      }
      const currentRow = prevState.selectedItem?.row;
      const nextRow = currentRow === undefined ? 0 : currentRow + rowDelta;
      if (nextRow < 0 || nextRow >= numberOfAlerts) {
        return prevState;
      }
      const currentColumn = prevState.selectedItem?.column;
      const nextColumn =
        currentColumn === undefined ? 0 : currentColumn + columnDelta;
      // Jump to the location of the new cell
      const rowData = this.props.resultSet.rows[nextRow];
      if (nextColumn < 0 || nextColumn >= rowData.length) {
        return prevState;
      }
      const cellData = rowData[nextColumn];
      if (cellData != null && typeof cellData === "object") {
        const location = tryGetResolvableLocation(cellData.url);
        if (location !== undefined) {
          jumpToLocation(location, this.props.databaseUri);
        }
      }
      this.scroller.scrollIntoViewOnNextUpdate();
      return {
        ...prevState,
        selectedItem: { row: nextRow, column: nextColumn },
      };
    });
  }

  componentDidUpdate() {
    this.scroller.update();
  }

  componentDidMount() {
    this.scroller.update();
    onNavigation.addListener(this.handleNavigationEvent);
  }

  componentWillUnmount() {
    onNavigation.removeListener(this.handleNavigationEvent);
  }
}
