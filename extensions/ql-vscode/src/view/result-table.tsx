import * as React from 'react';
import cx from 'classnames';
import { ResultSet, TupleValue, LocationStyle, LocationValue, isResolvableLocation } from '../bqrs-types';
import './results.css';
import { vscode } from './results';

/**
 * Render a location as a link which when clicked displays the original location.
 */
function renderLocation(loc: LocationValue, label: string | undefined, _prim: TupleValue,
  snapshotUri: string): JSX.Element {

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
    case LocationStyle.No: return <span>{label}</span>;
  }
}

/**
 * Render one column of a tuple.
 */
function renderTupleValue(v: TupleValue, snapshotUri: string): JSX.Element {
  switch (v.t) {
    case 'i': return <span>{v.v}</span>;
    case 'u': return <a href={v.v}>{v.v}</a>;
    case 'd': return <span>XXX dates unimplemented</span>;
    case 'f': return <span>{v.v}</span>;
    case 'b': return <span>{v.v}</span>;
    case 's': return <span>{v.v}</span>;
    case 'e': return renderLocation(v.loc, v.label, v.primitive, snapshotUri);
  }
}

export interface ResultTableProps {
  selected: boolean;
  resultSet: ResultSet;
  snapshotUri: string;
}

export class ResultTable extends React.Component<ResultTableProps, {}> {
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
      [this.selectedClassName]: selected
    });

    return <table className={tableClassName}>
      <thead>
        <tr>
          {resultSet.columns.map((col, index) => {
            const displayName = col.name || `[${index}]`;
            return <th><b>{displayName}</b></th>;
          })}
        </tr>
      </thead>
      <tbody>
        {
          resultSet.results.map((tuple, i) =>
            <tr className={(i % 2) ? this.oddRowClassName : this.evenRowClassName}>
              {tuple.map(item => <td>{renderTupleValue(item, snapshotUri)}</td>)}
            </tr>
          )
        }
      </tbody>
    </table>;
  }
}
