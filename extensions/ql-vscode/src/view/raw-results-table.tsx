import cx from 'classnames';
import * as React from "react";
import { className, evenRowClassName, oddRowClassName, renderLocation, ResultTableProps, selectedClassName } from "./result-table-utils";
import { RawTableResultSet, ResultValue } from "./results";

export type RawTableProps = ResultTableProps & { resultSet: RawTableResultSet };




export class RawTable extends React.Component<RawTableProps, {}> {
  constructor(props: RawTableProps) {
    super(props);
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
                return <th key={index}><b>{displayName}</b></th>;
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
  