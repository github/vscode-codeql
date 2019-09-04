import * as React from 'react';
import cx from 'classnames';
import { LocationStyle, LocationValue, isResolvableLocation } from 'semmle-bqrs';
import './results.css';
import { vscode, ResultSet, ResultValue } from './results';

/**
 * Render a location as a link which when clicked displays the original location.
 */
function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  snapshotUri: string): JSX.Element {

  if (loc !== undefined) {
    switch (loc.t) {
      case LocationStyle.FivePart: {
        if (isResolvableLocation(loc)) {
          return <a href="#" onClick={(e) => {
            vscode.postMessage({
              t: 'viewSourceFile',
              loc,
              snapshotUri
            });
            e.preventDefault();
            e.stopPropagation();
          }}>{label}</a>;
        }
        else {
          return <span>{label}</span>;
        }
      }
      case LocationStyle.String: return <span>{loc.loc}</span>;
    }
  }

  return <span/>
}

/**
 * Render one column of a tuple.
 */
function renderTupleValue(v: ResultValue, snapshotUri: string): JSX.Element {
  if (typeof v === 'string') {
    return <span>{v}</span>
  }
  else if ('uri' in v) {
    return <a href={v.uri}>{v.uri}</a>;
  }
  else {
    return renderLocation(v.location, v.label, snapshotUri);
  }
}

export interface ResultTableProps {
  selected: boolean;
  resultSet: ResultSet;
  snapshotUri: string;
}

interface ResultTableState {
}

export class ResultTable extends React.Component<ResultTableProps, ResultTableState> {
  private readonly className = 'ql-vscode__result-table';
  private readonly selectedClassName = `${this.className}--selected`;
  private readonly evenRowClassName = 'ql-vscode__result-table-row--even';
  private readonly oddRowClassName = 'ql-vscode__result-table-row--odd';

  constructor(props: ResultTableProps) {
    super(props);

    this.state = {};
  }

  render(): React.ReactNode {
    const { resultSet, selected, snapshotUri } = this.props;

    const tableClassName = cx(this.className, {
      [ this.selectedClassName ]: selected
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
            <tr key={rowIndex} className={ (rowIndex % 2) ? this.oddRowClassName : this.evenRowClassName }>
              {
                [
                  <td key={-1}>{rowIndex + 1}</td>,
                  ...row.map((value, columnIndex) =>
                    <td key={columnIndex}>
                    {
                      renderTupleValue(value, snapshotUri)
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
