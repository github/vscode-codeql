import * as React from "react";
import { renderLocation, ResultTableProps, zebraStripe, className, nextSortDirection } from "./result-table-utils";
import { vscode } from "./results";
import { ResultValue } from "../adapt";
import { SortDirection, RAW_RESULTS_LIMIT, RawResultsSortState } from "../interface-types";
import { RawTableResultSet } from "../interface-utils";

export type RawTableProps = ResultTableProps & {
  resultSet: RawTableResultSet;
  sortState?: RawResultsSortState;
  offset: number;
};

export class RawTable extends React.Component<RawTableProps, {}> {
  constructor(props: RawTableProps) {
    super(props);
  }

  render(): React.ReactNode {
    const { resultSet, databaseUri } = this.props;

    let dataRows = this.props.resultSet.rows;
    let numTruncatedResults = 0;
    if (dataRows.length > RAW_RESULTS_LIMIT) {
      numTruncatedResults = dataRows.length - RAW_RESULTS_LIMIT;
      dataRows = dataRows.slice(0, RAW_RESULTS_LIMIT);
    }

    const tableRows = dataRows.map((row, rowIndex) =>
      <tr key={rowIndex} {...zebraStripe(rowIndex)}>
        {
          [
            <td key={-1}>{rowIndex + 1 + this.props.offset}</td>,
            ...row.map((value, columnIndex) =>
              <td key={columnIndex}>
                {
                  renderTupleValue(value, databaseUri)
                }
              </td>)
          ]
        }
      </tr>
    );

    if (numTruncatedResults > 0) {
      const colSpan = dataRows[0].length + 1; // one row for each data column, plus index column
      tableRows.push(<tr><td key={'message'} colSpan={colSpan} style={{ textAlign: 'center', fontStyle: 'italic' }}>
        Too many results to show at once. {numTruncatedResults} result(s) omitted.
      </td></tr>);
    }

    return <table className={className}>
      <thead>
        <tr>
          {
            [
              <th key={-1}><b>#</b></th>,
              ...resultSet.schema.columns.map((col, index) => {
                const displayName = col.name || `[${index}]`;
                const sortDirection = this.props.sortState && index === this.props.sortState.columnIndex ? this.props.sortState.sortDirection : undefined;
                return <th className={"sort-" + (sortDirection !== undefined ? SortDirection[sortDirection] : "none")} key={index} onClick={() => this.toggleSortStateForColumn(index)}><b>{displayName}</b></th>;
              })
            ]
          }
        </tr>
      </thead>
      <tbody>
        {tableRows}
      </tbody>
    </table>;
  }

  private toggleSortStateForColumn(index: number): void {
    const sortState = this.props.sortState;
    const prevDirection = sortState && sortState.columnIndex === index ? sortState.sortDirection : undefined;
    const nextDirection = nextSortDirection(prevDirection);
    const nextSortState = nextDirection === undefined ? undefined : {
      columnIndex: index,
      sortDirection: nextDirection
    };
    vscode.postMessage({
      t: 'changeSort',
      resultSetName: this.props.resultSet.schema.name,
      sortState: nextSortState
    });
  }
}

/**
 * Render one column of a tuple.
 */
function renderTupleValue(v: ResultValue, databaseUri: string): JSX.Element {
  if (typeof v === 'string') {
    return <span>{v}</span>;
  }
  else if ('uri' in v) {
    return <a href={v.uri}>{v.uri}</a>;
  }
  else {
    return renderLocation(v.location, v.label, databaseUri);
  }
}
