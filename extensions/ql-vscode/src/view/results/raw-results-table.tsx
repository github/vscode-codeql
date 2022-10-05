import * as React from 'react';
import { ResultTableProps, className, emptyQueryResultsMessage, jumpToLocation } from './result-table-utils';
import { RAW_RESULTS_LIMIT, RawResultsSortState } from '../../pure/interface-types';
import { RawTableResultSet } from '../../pure/interface-types';
import RawTableHeader from './RawTableHeader';
import RawTableRow from './RawTableRow';
import { ResultRow } from '../../pure/bqrs-cli-types';
import { NavigationEvent, onNavigation } from './results';
import { tryGetResolvableLocation } from '../../pure/bqrs-utils';

export type RawTableProps = ResultTableProps & {
  resultSet: RawTableResultSet;
  sortState?: RawResultsSortState;
  offset: number;
};

interface RawTableState {
  selectedItem?: { row: number, column: number };
}

export class RawTable extends React.Component<RawTableProps, RawTableState> {
  constructor(props: RawTableProps) {
    super(props);
    this.setSelection = this.setSelection.bind(this);
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
    this.state = {};
  }

  private setSelection(row: number, column: number) {
    this.setState(prev => ({
      ...prev,
      selectedItem: { row, column }
    }));
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

    const tableRows = dataRows.map((row: ResultRow, rowIndex: number) =>
      <RawTableRow
        key={rowIndex}
        rowIndex={rowIndex + this.props.offset}
        row={row}
        databaseUri={databaseUri}
        isSelected={this.state.selectedItem?.row === rowIndex}
        onSelected={this.setSelection}
      />
    );

    if (numTruncatedResults > 0) {
      const colSpan = dataRows[0].length + 1; // one row for each data column, plus index column
      tableRows.push(<tr><td key={'message'} colSpan={colSpan} style={{ textAlign: 'center', fontStyle: 'italic' }}>
        Too many results to show at once. {numTruncatedResults} result(s) omitted.
      </td></tr>);
    }

    return <table className={className}>
      <RawTableHeader
        columns={resultSet.schema.columns}
        schemaName={resultSet.schema.name}
        sortState={this.props.sortState}
      />
      <tbody>
        {tableRows}
      </tbody>
    </table>;
  }

  private handleNavigationEvent(event: NavigationEvent) {
    switch (event.t) {
      case 'navigateAlert': {
        this.setState(prevState => {
          const numberOfAlerts = this.props.resultSet.rows.length;
          if (numberOfAlerts === 0) {
            return prevState;
          }
          const currentRow = prevState.selectedItem?.row;
          const nextRow = currentRow === undefined
            ? 0
            : (currentRow + event.direction);
          if (nextRow < 0 || nextRow >= numberOfAlerts) {
            return prevState;
          }
          const column = prevState.selectedItem?.column ?? 0;
          // Jump to the location of the new cell
          const rowData = this.props.resultSet.rows[nextRow];
          if (column < 0 || column >= rowData.length) {
            return prevState;
          }
          const cellData = rowData[column];
          if (cellData != null && typeof cellData === 'object') {
            const location = tryGetResolvableLocation(cellData.url);
            if (location !== undefined) {
              jumpToLocation(location, this.props.databaseUri);
            }
          }
          return {
            ...prevState,
            selectedItem: { row: nextRow, column }
          };
        });
        break;
      }
      case 'navigatePath': {
        break; // No effect for the raw result view, as results can not have associated paths.
      }
    }
  }

  componentDidMount() {
    onNavigation.addListener(this.handleNavigationEvent);
  }

  componentWillUnmount() {
    onNavigation.removeListener(this.handleNavigationEvent);
  }
}
