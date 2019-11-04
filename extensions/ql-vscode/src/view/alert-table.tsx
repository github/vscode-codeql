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
    const octiconChevronDown = <svg className="octicon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.62-.618 4.356 4.357z" />
</svg>;
    const octiconChevronRight = <svg className="octicon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.7 13.7L5 13l4.6-4.6L5 3.7l.7-.7 5 5v.7l-5 5z" />
</svg>;
    const octiconListUnordered = <svg className="octicon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M2 3H1v1h1V3zm0 3H1v1h1V6zM1 9h1v1H1V9zm1 3H1v1h1v-1zm2-9h11v1H4V3zm11 3H4v1h11V6zM4 9h11v1H4V9zm11 3H4v1h11v-1z" />
</svg>;
    const octiconInfo = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M8.568 1.03a6.8 6.8 0 0 1 4.192 2.02 7.06 7.06 0 0 1 .46 9.39 6.85 6.85 0 0 1-8.58 1.74 7 7 0 0 1-3.12-3.5 7.12 7.12 0 0 1-.23-4.71 7 7 0 0 1 2.77-3.79 6.8 6.8 0 0 1 4.508-1.15zm.472 12.85a5.89 5.89 0 0 0 3.41-2.07 6.07 6.07 0 0 0-.4-8.06 5.82 5.82 0 0 0-7.43-.74 6.06 6.06 0 0 0 .5 10.29 5.81 5.81 0 0 0 3.92.58zM8.51 7h-1v4h1V7zm0-2h-1v1h1V5z" />
</svg>;

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
      const indicator = currentResultExpanded ? octiconChevronDown : octiconChevronRight;
      if (result.codeFlows === undefined) {
        let rowHeader = <td>{octiconInfo}</td>;
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
            <td onMouseDown={toggler(expansionIndex)}>{indicator} {octiconListUnordered}</td><td>{msg}</td>
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
