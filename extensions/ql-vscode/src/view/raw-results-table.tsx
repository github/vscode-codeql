import cx from 'classnames';
import * as React from "react";
import { className, evenRowClassName, oddRowClassName, renderLocation, ResultTableProps, selectedClassName } from "./result-table-utils";
import { RawTableResultSet, ResultValue } from "./results";
import { assertNever } from "../helpers-pure";

export type RawTableProps = ResultTableProps & { resultSet: RawTableResultSet };

export interface RawTableState {
  sortState?: SortState;
}

export class RawTable extends React.Component<RawTableProps, RawTableState> {
  constructor(props: RawTableProps) {
    super(props);

    this.state = {
      sortState: undefined
    };
  }

  render(): React.ReactNode {
    const { resultSet, selected, databaseUri } = this.props;

    const tableClassName = cx(className, {
      [selectedClassName]: selected
    });

    return <table className={tableClassName}>
      <thead>
        <tr>
          {
            [
              <th key={-1}><b>#</b></th>,
              ...resultSet.schema.columns.map((col, index) => {
                const displayName = col.name || `[${index}]`;
                const sortDirection = this.state.sortState && index === this.state.sortState.columnIndex ? this.state.sortState.direction : undefined;
                return <th className={"sort-" + (sortDirection !== undefined ? sorting.Direction[sortDirection] : "none")} key={index} onClick={() => this.toggleSortStateForColumn(index)}><b>{displayName}</b></th>;
              })
            ]
          }
        </tr>
      </thead>
      <tbody>
        {
          this.props.resultSet.rows.map((row, rowIndex) =>
            <tr key={rowIndex} className={(rowIndex % 2) ? oddRowClassName : evenRowClassName}>
              {
                [
                  <td key={-1}>{rowIndex + 1}</td>,
                  ...row.map((value, columnIndex) =>
                    <td key={columnIndex}>
                      {
                        renderTupleValue(value, databaseUri)
                      }
                    </td>)
                ]
              }
            </tr>
          )
        }
      </tbody>
    </table>;
  }

  private toggleSortStateForColumn(index: number) {
    this.setState(previousState => {
      const prevDirection = previousState.sortState && previousState.sortState.columnIndex === index ?
        previousState.sortState.direction : undefined;
      const nextDirection = sorting.nextDirection(prevDirection);
      if (nextDirection === undefined) {
        return { sortState: undefined };
      } else {
        return {
          sortState: {
            columnIndex: index,
            direction: nextDirection
          }
        };
      }
    });
  }
}


/**
 * Render one column of a tuple.
 */
function renderTupleValue(v: ResultValue, databaseUri: string): JSX.Element {
  if (typeof v === 'string') {
    return <span>{v}</span>
  }
  else if ('uri' in v) {
    return <a href={v.uri}>{v.uri}</a>;
  }
  else {
    return renderLocation(v.location, v.label, databaseUri);
  }
}

namespace sorting {
  export enum Direction {
    asc, desc
  }

  export function nextDirection(direction: Direction | undefined): Direction | undefined {
    switch (direction) {
      case Direction.asc:
        return Direction.desc;
      case Direction.desc:
        return undefined;
      case undefined:
        return Direction.asc;
      default:
        return assertNever(direction);
    }
  }
}

export interface SortState {
  columnIndex: number;
  direction: sorting.Direction;
}
