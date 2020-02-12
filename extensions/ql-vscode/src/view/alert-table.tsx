import * as path from 'path';
import * as React from 'react';
import * as Sarif from 'sarif';
import * as Keys from '../result-keys';
import { LocationStyle } from 'semmle-bqrs';
import * as octicons from './octicons';
import { className, renderLocation, ResultTableProps, zebraStripe, selectableZebraStripe, jumpToLocation, nextSortDirection } from './result-table-utils';
import { PathTableResultSet, onNavigation, NavigationEvent, vscode } from './results';
import { parseSarifPlainTextMessage, parseSarifLocation } from '../sarif-utils';
import { InterpretedResultsSortColumn, SortDirection, InterpretedResultsSortState } from '../interface-types';

export type PathTableProps = ResultTableProps & { resultSet: PathTableResultSet };
export interface PathTableState {
  expanded: { [k: string]: boolean };
  selectedPathNode: undefined | Keys.PathNode;
}

export class PathTable extends React.Component<PathTableProps, PathTableState> {
  constructor(props: PathTableProps) {
    super(props);
    this.state = { expanded: {}, selectedPathNode: undefined };
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
  }

  /**
   * Given a list of `indices`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  toggle(e: React.MouseEvent, indices: number[]) {
    this.setState(previousState => {
      if (previousState.expanded[indices[0]]) {
        return { expanded: { ...previousState.expanded, [indices[0]]: false } };
      }
      else {
        const expanded = { ...previousState.expanded };
        for (const index of indices) {
          expanded[index] = true;
        }
        return { expanded };
      }
    });
    e.stopPropagation();
    e.preventDefault();
  }

  sortClass(column: InterpretedResultsSortColumn): string {
    const sortState = this.props.resultSet.sortState;
    if (sortState !== undefined && sortState.sortBy === column) {
      return sortState.sortDirection === SortDirection.asc ? 'sort-asc' : 'sort-desc';
    }
    else {
      return 'sort-none';
    }
  }

  getNextSortState(column: InterpretedResultsSortColumn): InterpretedResultsSortState | undefined {
    const oldSortState = this.props.resultSet.sortState;
    const prevDirection = oldSortState && oldSortState.sortBy === column ? oldSortState.sortDirection : undefined;
    const nextDirection = nextSortDirection(prevDirection, true);
    return nextDirection === undefined ? undefined :
      { sortBy: column, sortDirection: nextDirection };
  }

  toggleSortStateForColumn(column: InterpretedResultsSortColumn): void {
    vscode.postMessage({
      t: 'changeInterpretedSort',
      sortState: this.getNextSortState(column),
    });
  }

  render(): JSX.Element {
    const { databaseUri, resultSet } = this.props;

    const header = <thead>
      <tr>
        <th colSpan={2}></th>
        <th className={this.sortClass('alert-message') + ' vscode-codeql__alert-message-cell'} colSpan={3} onClick={() => this.toggleSortStateForColumn('alert-message')}>Message</th>
      </tr>
    </thead>;

    const rows: JSX.Element[] = [];
    const { numTruncatedResults, sourceLocationPrefix } = resultSet;

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
          const renderedLocation = renderSarifLocationWithText(part.text, relatedLocationsById[part.dest],
            undefined);
          result.push(<span>{renderedLocation} </span>);
        }
      } return result;
    }

    function renderNonLocation(msg: string | undefined, locationHint: string): JSX.Element | undefined {
      if (msg == undefined)
        return undefined;
      return <span title={locationHint}>{msg}</span>;
    }

    const updateSelectionCallback = (pathNodeKey: Keys.PathNode | undefined) => {
      return () => {
        this.setState(previousState => ({
          ...previousState,
          selectedPathNode: pathNodeKey
        }));
      }
    };

    function renderSarifLocationWithText(text: string | undefined, loc: Sarif.Location, pathNodeKey: Keys.PathNode | undefined): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc, sourceLocationPrefix);
      switch (parsedLoc.t) {
        case 'NoLocation':
          return renderNonLocation(text, parsedLoc.hint);
        case LocationStyle.FivePart:
        case LocationStyle.WholeFile:
          return renderLocation(parsedLoc, text, databaseUri, undefined, updateSelectionCallback(pathNodeKey));
      }
      return undefined;
    }

    /**
     * Render sarif location as a link with the text being simply a
     * human-readable form of the location itself.
     */
    function renderSarifLocation(loc: Sarif.Location, pathNodeKey: Keys.PathNode | undefined): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc, sourceLocationPrefix);
      let shortLocation, longLocation: string;
      switch (parsedLoc.t) {
        case 'NoLocation':
          return renderNonLocation("[no location]", parsedLoc.hint);
        case LocationStyle.WholeFile:
          shortLocation = `${path.basename(parsedLoc.userVisibleFile)}`;
          longLocation = `${parsedLoc.userVisibleFile}`;
          return renderLocation(parsedLoc, shortLocation, databaseUri, longLocation, updateSelectionCallback(pathNodeKey));
        case LocationStyle.FivePart:
          shortLocation = `${path.basename(parsedLoc.userVisibleFile)}:${parsedLoc.lineStart}:${parsedLoc.colStart}`;
          longLocation = `${parsedLoc.userVisibleFile}`;
          return renderLocation(parsedLoc, shortLocation, databaseUri, longLocation, updateSelectionCallback(pathNodeKey));
      }
    }

    const toggler: (indices: number[]) => (e: React.MouseEvent) => void = (indices) => {
      return (e) => this.toggle(e, indices);
    };

    const noResults = <span>No Results</span>; // TODO: Maybe make this look nicer

    let expansionIndex = 0;

    if (resultSet.sarif.runs.length === 0) return noResults;
    if (resultSet.sarif.runs[0].results === undefined) return noResults;

    resultSet.sarif.runs[0].results.forEach((result, resultIndex) => {
      const text = result.message.text || '[no text]';
      const msg: JSX.Element[] =
        result.relatedLocations === undefined ?
          [<span>{text}</span>] :
          renderRelatedLocations(text, result.relatedLocations);

      const currentResultExpanded = this.state.expanded[expansionIndex];
      const indicator = currentResultExpanded ? octicons.chevronDown : octicons.chevronRight;
      const location = result.locations !== undefined && result.locations.length > 0 &&
        renderSarifLocation(result.locations[0], Keys.none);
      const locationCells = <td className="vscode-codeql__location-cell">{location}</td>;

      if (result.codeFlows === undefined) {
        rows.push(
          <tr {...zebraStripe(resultIndex)}>
            <td className="vscode-codeql__icon-cell">{octicons.info}</td>
            <td colSpan={3}>
              {msg}
            </td>
            {locationCells}
          </tr>
        );
      }
      else {
        const paths: Sarif.ThreadFlow[] = Keys.getAllPaths(result);

        const indices = paths.length == 1 ?
          [expansionIndex, expansionIndex + 1] : /* if there's exactly one path, auto-expand
                                                  * the path when expanding the result */
          [expansionIndex];

        rows.push(
          <tr {...zebraStripe(resultIndex)}>
            <td className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell" onMouseDown={toggler(indices)}>
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
        expansionIndex++;

        paths.forEach((path, pathIndex) => {
          const pathKey = { resultIndex, pathIndex };
          const currentPathExpanded = this.state.expanded[expansionIndex];
          if (currentResultExpanded) {
            const indicator = currentPathExpanded ? octicons.chevronDown : octicons.chevronRight;
            rows.push(
              <tr {...zebraStripe(resultIndex)}>
                <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                <td className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell" onMouseDown={toggler([expansionIndex])}>{indicator}</td>
                <td className="vscode-codeql__text-center" colSpan={3}>
                  Path
                </td>
              </tr>
            );
          }
          expansionIndex++;

          if (currentResultExpanded && currentPathExpanded) {
            const pathNodes = path.locations;
            for (let pathNodeIndex = 0; pathNodeIndex < pathNodes.length; ++pathNodeIndex) {
              const pathNodeKey: Keys.PathNode = { ...pathKey, pathNodeIndex };
              const step = pathNodes[pathNodeIndex];
              const msg = step.location !== undefined && step.location.message !== undefined ?
                renderSarifLocationWithText(step.location.message.text, step.location, pathNodeKey) :
                '[no location]';
              const additionalMsg = step.location !== undefined ?
                renderSarifLocation(step.location, pathNodeKey) :
                '';
              let isSelected = Keys.equalsNotUndefined(this.state.selectedPathNode, pathNodeKey);
              const stepIndex = pathNodeIndex + 1; // Convert to 1-based
              const zebraIndex = resultIndex + stepIndex;
              rows.push(
                <tr className={isSelected ? 'vscode-codeql__selected-path-node' : undefined}>
                  <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                  <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                  <td {...selectableZebraStripe(isSelected, zebraIndex, 'vscode-codeql__path-index-cell')}>{stepIndex}</td>
                  <td {...selectableZebraStripe(isSelected, zebraIndex)}>{msg} </td>
                  <td {...selectableZebraStripe(isSelected, zebraIndex, 'vscode-codeql__location-cell')}>{additionalMsg}</td>
                </tr>);
            }
          }
        });

      }
    });

    if (numTruncatedResults > 0) {
      rows.push(<tr><td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic' }}>
        Too many results to show at once. {numTruncatedResults} result(s) omitted.
      </td></tr>);
    }

    return <table className={className}>
      {header}
      <tbody>{rows}</tbody>
    </table>;
  }

  private handleNavigationEvent(event: NavigationEvent) {
    this.setState(prevState => {
      let { selectedPathNode } = prevState;
      if (selectedPathNode === undefined) return prevState;

      let path = Keys.getPath(this.props.resultSet.sarif, selectedPathNode);
      if (path === undefined) return prevState;

      let nextIndex = selectedPathNode.pathNodeIndex + event.direction;
      if (nextIndex < 0 || nextIndex >= path.locations.length) return prevState;

      let sarifLoc = path.locations[nextIndex].location;
      if (sarifLoc === undefined) return prevState;

      let loc = parseSarifLocation(sarifLoc, this.props.resultSet.sourceLocationPrefix);
      if (loc.t === 'NoLocation') return prevState;

      jumpToLocation(loc, this.props.databaseUri);
      let newSelection = { ...selectedPathNode, pathNodeIndex: nextIndex };
      return { ...prevState, selectedPathNode: newSelection };
    });
  }

  componentDidMount() {
    onNavigation.addListener(this.handleNavigationEvent);
  }

  componentWillUnmount() {
    onNavigation.removeListener(this.handleNavigationEvent);
  }
}
