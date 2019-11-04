import cx from 'classnames';
import * as path from 'path';
import * as React from "react";
import * as Sarif from "sarif";
import { LocationStyle } from "semmle-bqrs";
import { className, evenRowClassName, oddRowClassName, pathRowClassName, renderLocation, ResultTableProps, selectedClassName } from "./result-table-utils";
import { PathTableResultSet } from "./results";


export type PathTableProps = ResultTableProps & { resultSet: PathTableResultSet };
export interface PathTableState {
  expanded: { [k: string]: boolean };
}

interface SarifLink {
  dest: number
  text: string
}

type SarifMessageComponent = string | SarifLink

/**
 * Unescape "[", "]" and "\\" like in sarif plain text messages
 */
function unescapeSarifText(message: string): string {
  return message.replace(/\\\[/g, "[").replace(/\\\]/g, "]").replace(/\\\\/, "\\");
}

function parseSarifPlainTextMessage(message: string): SarifMessageComponent[] {
  let results: SarifMessageComponent[] = [];

  // We want something like "[linkText](4)", except that "[" and "]" may be escaped. The lookbehind asserts
  // that the initial [ is not escaped. Then we parse a link text with "[" and "]" escaped. Then we parse the numerical target.
  // Technically we could have any uri in the target but we don't output that yet.
  // The possibility of escaping outside the link is not mentioned in the sarif spec but we always output sartif this way.
  const linkRegex = /(?<=(?<!\\)(\\\\)*)\[(?<linkText>([^\\\]\[]|\\\\|\\\]|\\\[)*)\]\((?<linkTarget>[0-9]+)\)/g;
  let result: RegExpExecArray | null;
  let curIndex = 0;
  while ((result = linkRegex.exec(message)) !== null) {
    results.push(unescapeSarifText(message.substring(curIndex, result.index)));
    const linkText = result.groups!["linkText"];
    const linkTarget = +result.groups!["linkTarget"];
    results.push({ dest: linkTarget, text: unescapeSarifText(linkText) });
    curIndex = result.index + result[0].length;
  }
  results.push(unescapeSarifText(message.substring(curIndex, message.length)));
  return results;
}

/**
 * Computes a path normalized to reflect conventional normalization
 * of windows paths into zip archive paths.
 * @param sourceLocationPrefix The source location prefix of a database. May be
 * unix style `/foo/bar/baz` or windows-style `C:\foo\bar\baz`.
 * @param sarifRelativeUri A uri relative to sourceLocationPrefix.
 * @returns A string that is valid for the `.file` field of a `FivePartLocation`:
 * directory separators are normalized, but drive letters `C:` may appear.
 */
export function getPathRelativeToSourceLocationPrefix(sourceLocationPrefix: string, sarifRelativeUui: string) {
  const normalizedSourceLocationPrefix = sourceLocationPrefix.replace(/\\/g, '/');
  return path.join(normalizedSourceLocationPrefix, decodeURIComponent(sarifRelativeUui));
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
      const parts = parseSarifPlainTextMessage(msg);


      for (const part of parts) {
        if (typeof part === "string") {
          result.push(<span>{part} </span>);
        } else {
          const renderedLocation = renderSarifLocation(part.text, relatedLocationsById[part.dest]);
          result.push(<span>{renderedLocation} </span>);
        }
      } return result;
    }

    function renderNonLocation(msg: string | undefined, locationHint: string): JSX.Element | undefined {
      if (msg == undefined)
        return undefined;
      return <span title={locationHint}>{msg}</span>;
    }

    function renderSarifLocation(msg: string | undefined, loc: Sarif.Location): JSX.Element | undefined {
      if (loc.physicalLocation === undefined)
        return renderNonLocation(msg, 'no physical location');

      const physicalLocation = loc.physicalLocation;

      if (physicalLocation.artifactLocation === undefined)
        return renderNonLocation(msg, 'no artifact location');

      if (physicalLocation.artifactLocation.uri === undefined)
        return renderNonLocation(msg, 'artifact location has no uri');

      // This is not necessarily really an absolute uri; it could either be a
      // file uri or a relative uri.
      const uri = physicalLocation.artifactLocation.uri;

      if (physicalLocation.region === undefined)
        return <span>{uri}</span>;

      const region = physicalLocation.region;
      const fileUriRegex = /file:/;
      const effectiveLocation = uri.match(fileUriRegex) ?
        decodeURIComponent(uri.replace(fileUriRegex, '')) :
        getPathRelativeToSourceLocationPrefix(sourceLocationPrefix, uri);

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

      return renderLocation(
        {
          t: LocationStyle.FivePart,
          file: effectiveLocation,
          lineStart,
          colStart,
          lineEnd,
          colEnd,
        },
        msg,
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
          rowHeader = <td>{renderSarifLocation('Result', result.locations[0])}</td>;
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
                    renderSarifLocation(step.location.message.text, step.location) :
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
