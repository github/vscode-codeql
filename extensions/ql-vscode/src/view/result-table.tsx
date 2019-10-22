import cx from 'classnames';
import * as path from 'path';
import * as React from 'react';
import * as Sarif from 'sarif';
import { isResolvableLocation, LocationStyle, LocationValue } from 'semmle-bqrs';
import { ResultSet, PathTableResultSet, RawTableResultSet, ResultValue, vscode } from './results';

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
  resultSet: ResultSet;
  databaseUri: string;
  resultsPath: string | undefined;
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
    const { resultSet, selected, databaseUri, resultsPath } = this.props;

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
    this.setState(previousState => ({
      expanded: { ...previousState.expanded, [i]: !(previousState.expanded[i]) }
    }));
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

    function renderRelatedLocations(msg: string, relatedLocations: Sarif.Location[]): JSX.Element[] {
      const relatedLocationsById: { [k: string]: Sarif.Location } = {};
      for (let loc of relatedLocations) {
        relatedLocationsById[loc.id!] = loc;
      }

      const result: JSX.Element[] = [];
      // match things like `[link-text](related-location-id)`
      const linkRegex = /\[(.*?)\]\((.*?)\)/;
      const parts = msg.split(linkRegex);

      for (let i = 0; i + 1 < parts.length; i += 3) {
        const renderedLocation = renderSarifLocation({ text: parts[i + 1] }, relatedLocationsById[parts[i + 2]]);
        result.push(<span>{parts[i]}{renderedLocation}</span>);
      }
      result.push(<span>{parts[parts.length - 1]}</span>);
      return result;
    }

    function renderNonLocation(msg: Sarif.Message | undefined, locationHint: string): JSX.Element | undefined {
      if (msg == undefined)
        return undefined;
      if (msg.text === undefined)
        return undefined;
      return <span title={locationHint}>{msg.text}</span>;
    }

    function renderSarifLocation(msg: Sarif.Message | undefined, loc: Sarif.Location): JSX.Element | undefined {
      if (loc.physicalLocation === undefined)
        return renderNonLocation(msg, 'no physical location');

      const physicalLocation = loc.physicalLocation;

      if (physicalLocation.artifactLocation === undefined)
        return renderNonLocation(msg, 'no artifact location');

      if (physicalLocation.artifactLocation.uri === undefined)
        return renderNonLocation(msg, 'artifact location has no uri');

      const uri = physicalLocation.artifactLocation.uri;

      if (physicalLocation.region === undefined)
        return <span>{uri}</span>;

      const region = physicalLocation.region;
      const fileUriRegex = /file:/;
      const effectiveLocation = uri.match(fileUriRegex) ?
        uri.replace(fileUriRegex, '') :
        path.join(sourceLocationPrefix, uri);

      // We assume that the SARIF we're given always has startLine
      // This is not mandated by the SARIF spec, but should be true of
      // SARIF output by our own tools.
      const lineStart = region.startLine!;

      // These defaults are from SARIF 2.1.0 spec, section 3.30.2, "Text Regions"
      // https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/sarif-v2.1.0-cs01.html#_Ref493492556
      const lineEnd = region.endLine === undefined ? lineStart : region.endLine;
      const colStart = region.startColumn === undefined ? 1 : region.startColumn;

      // We also assume that our tools will always supply `endColumn` field, which is
      // fortunate, since the SARIF spec says that it defaults to the end of the line, whose
      // length we don't know at this point in the code.
      //
      // It is off by one with respect to the way vscode counts columns in selections.
      const colEnd = region.endColumn! - 1;

      return msg && renderLocation(
        {
          t: LocationStyle.FivePart,
          file: effectiveLocation,
          lineStart,
          colStart,
          lineEnd,
          colEnd,
        },
        msg.text,
        databaseUri);
    }

    const toggler: (index: number) => (e: React.MouseEvent) => void = (index) => {
      return (e) => this.toggle(e, index);
    }

    const noResults = <span>No Results</span>; // TODO: Maybe make this look nicer
    let resultIndex = 0;
    let expansionIndex = 0;

    if (resultSet.sarif.runs.length === 0) return noResults;
    if (resultSet.sarif.runs[0].results === undefined) return noResults;

    for (const result of resultSet.sarif.runs[0].results) {
      const text = result.message.text || '[no text]'
      const msg: JSX.Element[] =
        result.relatedLocations === undefined ?
          [<span>{text}</span>] :
          renderRelatedLocations(text, result.relatedLocations);

      const currentResultExpanded = this.state.expanded[expansionIndex];
      const indicator = currentResultExpanded ? '-' : '+';
      if (result.codeFlows === undefined) {
        let rowHeader = <td>Result</td>;
        if (result.locations !== undefined && result.locations.length > 0) {
          rowHeader = <td>{renderSarifLocation({ text: 'Result' }, result.locations[0])}</td>;
        }
        rows.push(
          <tr className={(resultIndex % 2) ? oddRowClassName : evenRowClassName}>
            {rowHeader}<td>{msg}</td>
          </tr>
        );
      }
      else {
        rows.push(
          <tr className={(resultIndex % 2) ? oddRowClassName : evenRowClassName}>
            <td onMouseDown={toggler(expansionIndex)}>{indicator} Result</td><td>{msg}</td>
          </tr>
        );
        resultIndex++;
        expansionIndex++;

        if (result.codeFlows !== undefined) {
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
                  const msg = step.location !== undefined && step.location.message !== undefined ?
                    renderSarifLocation(step.location.message, step.location) :
                    '[no location]';
                  rows.push(<tr className={pathRowClassName}><td>{pathIndex}</td><td>- {msg}</td></tr>);
                  pathIndex++;
                }
              }
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
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} resultsPath={this.props.resultsPath} />;
      case 'SarifResultSet': return <PathTable
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} resultsPath={this.props.resultsPath} />;
    }
  }
}
