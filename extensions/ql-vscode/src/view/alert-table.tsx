import cx from 'classnames';
import * as octicons from './octicons';
import * as path from 'path';
import * as React from 'react';
import * as Sarif from 'sarif';
import { FivePartLocation, LocationStyle, StringLocation } from 'semmle-bqrs';
import { className, evenRowClassName, oddRowClassName, pathRowClassName, renderLocation, ResultTableProps, selectedClassName } from './result-table-utils';
import { PathTableResultSet } from './results';

export type PathTableProps = ResultTableProps & { resultSet: PathTableResultSet };
export interface PathTableState {
  expanded: { [k: string]: boolean };
}

interface SarifLink {
  dest: number
  text: string
}

type ParsedSarifLocation =
  | FivePartLocation
  // FivePartLocation has a `file` field, but it will sometimes include
  // a source location prefix, which contains build-specific information the user
  // doesn't really need to see. We ensure that `userVisibleFile` will not contain
  // that, and is appropriate for display in the UI.
  & { userVisibleFile: string }
  | StringLocation
  | { t: 'NoLocation', hint: string };

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

  /**
   * Given a list of `indexes`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  toggle(e: React.MouseEvent, indexes: number[]) {
    this.setState(previousState => {
      if (previousState.expanded[indexes[0]]) {
        return { expanded: { ...previousState.expanded, [indexes[0]]: false } };
      }
      else {
        const expanded = { ...previousState.expanded };
        for (const index of indexes) {
          expanded[index] = true;
        }
        return { expanded };
      }
    });
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
          const renderedLocation = renderSarifLocationWithText(part.text, relatedLocationsById[part.dest]);
          result.push(<span>{renderedLocation} </span>);
        }
      } return result;
    }

    function renderNonLocation(msg: string | undefined, locationHint: string): JSX.Element | undefined {
      if (msg == undefined)
        return undefined;
      return <span title={locationHint}>{msg}</span>;
    }

    function parseSarifLocation(loc: Sarif.Location): ParsedSarifLocation {
      const physicalLocation = loc.physicalLocation;
      if (physicalLocation === undefined)
        return { t: 'NoLocation', hint: 'no physical location' };
      if (physicalLocation.artifactLocation === undefined)
        return { t: 'NoLocation', hint: 'no artifact location' };
      if (physicalLocation.artifactLocation.uri === undefined)
        return { t: 'NoLocation', hint: 'artifact location has no uri' };

      // This is not necessarily really an absolute uri; it could either be a
      // file uri or a relative uri.
      const uri = physicalLocation.artifactLocation.uri;
      if (physicalLocation.region === undefined)
        return { t: LocationStyle.String, loc: uri };

      const region = physicalLocation.region;
      const fileUriRegex = /^file:/;
      const effectiveLocation = uri.match(fileUriRegex) ?
        decodeURIComponent(uri.replace(fileUriRegex, '')) :
        getPathRelativeToSourceLocationPrefix(sourceLocationPrefix, uri);
      const userVisibleFile = uri.match(fileUriRegex) ?
        decodeURIComponent(uri.replace(fileUriRegex, '')) :
        uri;

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

      return {
        t: LocationStyle.FivePart,
        file: effectiveLocation,
        userVisibleFile,
        lineStart,
        colStart,
        lineEnd,
        colEnd,
      };
    }

    function renderSarifLocationWithText(text: string | undefined, loc: Sarif.Location): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc);
      switch (parsedLoc.t) {
        case 'NoLocation':
          return renderNonLocation(text, parsedLoc.hint);
        case LocationStyle.String:
          return <span>{parsedLoc.loc}</span>;
        case LocationStyle.FivePart:
          return renderLocation(parsedLoc, text, databaseUri);
      }
    }

    /**
     * Render sarif location as a link with the text being simply a
     * human-readable form of the location itself.
     */
    function renderSarifLocation(loc: Sarif.Location): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc);
      switch (parsedLoc.t) {
        case 'NoLocation':
          return renderNonLocation("[no location]", parsedLoc.hint);
        case LocationStyle.String:
          return <span>{parsedLoc.loc}</span>;
        case LocationStyle.FivePart:
          const shortLocation = `${path.basename(parsedLoc.userVisibleFile)}:${parsedLoc.lineStart}:${parsedLoc.colStart}`;
          const longLocation = `${parsedLoc.userVisibleFile}`;
          return renderLocation(parsedLoc, shortLocation, databaseUri, longLocation);
      }
    }

    const toggler: (indexes: number[]) => (e: React.MouseEvent) => void = (indexes) => {
      return (e) => this.toggle(e, indexes);
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
      const indicator = currentResultExpanded ? octicons.chevronDown : octicons.chevronRight;
      const location = result.locations !== undefined && result.locations.length > 0 &&
        renderSarifLocation(result.locations[0]);
      const locationCells = <td className="vscode-codeql__location-cell">{location}</td>;

      if (result.codeFlows === undefined) {
        rows.push(
          <tr className={(resultIndex % 2) ? oddRowClassName : evenRowClassName}>
            <td className="vscode-codeql__icon-cell">{octicons.info}</td>
            <td colSpan={4}>
              {msg}
            </td>
            {locationCells}
          </tr>
        );
      }
      else {
        const paths: Sarif.ThreadFlow[] = [];
        for (const codeFlow of result.codeFlows) {
          for (const threadFlow of codeFlow.threadFlows) {
            paths.push(threadFlow);
          }
        }

        const indexes = paths.length == 1 ?
          [expansionIndex, expansionIndex + 1] : /* if there's exactly one path, auto-expand
                                                  * the path when expanding the result */
          [expansionIndex];
        rows.push(
          <tr className={(resultIndex % 2) ? oddRowClassName : evenRowClassName}>
            <td className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell" onMouseDown={toggler(indexes)}>
              {indicator}
            </td>
            <td className="vscode-codeql__icon-cell">
              {octicons.listUnordered}
            </td>
            <td colSpan={2}>
              {msg}
            </td>
            {locationCells}
          </tr >
        );
        resultIndex++;
        expansionIndex++;

        paths.forEach(path => {
          const currentPathExpanded = this.state.expanded[expansionIndex];
          if (currentResultExpanded) {
            const indicator = currentPathExpanded ? octicons.chevronDown : octicons.chevronRight;
            rows.push(
              <tr>
                <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                <td className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell" onMouseDown={toggler([expansionIndex])}>{indicator}</td>
                <td className="vscode-codeql__text-center" colSpan={2}>
                  Path
                    </td>
              </tr>
            );
          }
          expansionIndex++;

          if (currentResultExpanded && currentPathExpanded) {
            let pathIndex = 1;
            for (const step of path.locations) {
              const msg = step.location !== undefined && step.location.message !== undefined ?
                renderSarifLocationWithText(step.location.message.text, step.location) :
                '[no location]';
              const additionalMsg = step.location !== undefined ?
                renderSarifLocation(step.location) :
                '';

              rows.push(
                <tr className={pathRowClassName}>
                  <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                  <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                  <td className="vscode-codeql__path-index-cell">{pathIndex}</td>
                  <td>{msg}</td>
                  <td className="vscode-codeql__location-cell">{additionalMsg}</td>
                </tr>);
              pathIndex++;
            }
          }
        });

      }
    }

    return <table className={tableClassName}>
      <tbody>{rows}</tbody>
    </table>;
  }
}
