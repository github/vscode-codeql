import cx from 'classnames';
import * as path from 'path';
import * as React from 'react';
import { isResolvableLocation, LocationStyle, LocationValue } from 'semmle-bqrs';
import { SarifLocation } from '../interface-types';
import { InterfaceResultSet, PathTableResultSet, RawTableResultSet, ResultValue, vscode } from './results';
import './results.css';

/**
 * Render a location as a link which when clicked displays the original location.
 */
function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  databaseUri: string): JSX.Element {

  if (loc !== undefined) {
    switch (loc.t) {
      case LocationStyle.FivePart: {
        if (isResolvableLocation(loc)) {
          return <a href="#" onClick={(e) => {
            vscode.postMessage({
              t: 'viewSourceFile',
              loc,
              databaseUri
            });
            e.preventDefault();
            e.stopPropagation();
          }}>{label}</a>;
        }
        else {
          return <span>{label}</span>;
        }
      }
      case LocationStyle.String: return <span>{label}</span>;
    }
  }

  return <span />
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

export interface ResultTableProps {
  selected: boolean;
  resultSet: InterfaceResultSet;
  databaseUri: string;
}

export type RawTableProps = ResultTableProps & { resultSet: RawTableResultSet };
export type PathTableProps = ResultTableProps & { resultSet: PathTableResultSet };

export interface PathTableState {
  expanded: { [k: string]: boolean };
}

const className = 'ql-vscode__result-table';
const selectedClassName = `${className}--selected`;
const evenRowClassName = 'ql-vscode__result-table-row--even';
const oddRowClassName = 'ql-vscode__result-table-row--odd';
const pathRowClassName = 'ql-vscode__result-table-row--path';

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

export class PathTable extends React.Component<PathTableProps, PathTableState> {
  constructor(props: PathTableProps) {
    super(props);
    this.state = { expanded: {} };
  }

  toggle(e: React.MouseEvent, i: number) {
    this.setState({ expanded: { ...this.state.expanded, [i]: !(this.state.expanded[i]) } });
    e.stopPropagation();
    e.preventDefault();
  }

  render(): JSX.Element {
    const { selected, databaseUri, resultSet } = this.props;

    const tableClassName = cx(className, {
      [selectedClassName]: selected
    });

    const rows: JSX.Element[] = [];
    const sourceLocationPrefix = resultSet.sourceLocationPrefix;

    function renderSarifLocation(msg: { text: string } | undefined, loc: SarifLocation): JSX.Element | undefined {
      const region = loc.physicalLocation.region;
      return msg && renderLocation(
        {
          t: LocationStyle.FivePart,
          file: path.join(sourceLocationPrefix, loc.physicalLocation.artifactLocation.uri),
          colEnd: region.endColumn - 1,
          colStart: region.startColumn,
          lineEnd: region.endLine,
          lineStart: region.startLine,
        },
        msg.text,
        databaseUri);
    }

    const toggler: (index: number) => (e: React.MouseEvent) => void = (index) => {
      return (e) => this.toggle(e, index);
    }

    let resultIndex = 0;
    let expansionIndex = 0;
    for (const result of resultSet.sarif.runs[0].results) {
      const msg = renderSarifLocation(result.message, result.locations[0]);

      const currentResultExpanded = this.state.expanded[expansionIndex];
      const indicator = currentResultExpanded ? '-' : '+';
      rows.push(
        <tr className={(resultIndex % 2) ? oddRowClassName : evenRowClassName}>
          <td onMouseDown={toggler(expansionIndex)}>{indicator} Result</td><td>{msg}</td>
        </tr>
      );
      resultIndex++;
      expansionIndex++;

      for (const codeFlow of result.codeFlows) {
        for (const threadFlow of codeFlow.threadFlows) {

          const currentPathExpanded = this.state.expanded[expansionIndex];
          if (currentResultExpanded) {
            const indicator = currentPathExpanded ? '-' : '+';
            rows.push(<tr><td onMouseDown={toggler(expansionIndex)}>{indicator} Path</td></tr>);
          }
          expansionIndex++;

          if (currentResultExpanded && currentPathExpanded) {
            let pathIndex = 1;
            for (const step of threadFlow.locations) {
              const msg = renderSarifLocation(step.location.message, step.location);
              rows.push(<tr className={pathRowClassName}><td>{pathIndex}</td><td>- {msg}</td></tr>);
              pathIndex++;
            }
          }
        }
      }

    }

    return <table className={tableClassName}>
      <tbody>{rows}</tbody>
    </table>;
  }
}

export class ResultTable extends React.Component<ResultTableProps, {}> {

  constructor(props: ResultTableProps) {
    super(props);
  }

  render(): React.ReactNode {
    const { resultSet } = this.props;
    switch (resultSet.t) {
      case 'RawResultSet': return <RawTable
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} />;
      case 'SarifResultSet': return <PathTable
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} />;
    }
  }
}
