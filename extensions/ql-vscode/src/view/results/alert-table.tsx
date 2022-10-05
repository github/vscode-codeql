import * as path from 'path';
import * as React from 'react';
import * as Sarif from 'sarif';
import * as Keys from '../../pure/result-keys';
import * as octicons from './octicons';
import { className, renderLocation, ResultTableProps, zebraStripe, selectableZebraStripe, jumpToLocation, nextSortDirection, emptyQueryResultsMessage } from './result-table-utils';
import { onNavigation, NavigationEvent } from './results';
import { InterpretedResultSet, NavigateAlertMsg, NavigatePathMsg, SarifInterpretationData } from '../../pure/interface-types';
import {
  parseSarifPlainTextMessage,
  parseSarifLocation,
  isNoLocation
} from '../../pure/sarif-utils';
import { InterpretedResultsSortColumn, SortDirection, InterpretedResultsSortState } from '../../pure/interface-types';
import { vscode } from '../vscode-api';
import { isWholeFileLoc, isLineColumnLoc } from '../../pure/bqrs-utils';

export type PathTableProps = ResultTableProps & { resultSet: InterpretedResultSet<SarifInterpretationData> };
export interface PathTableState {
  expanded: Set<string>;
  selectedItem: undefined | Keys.PathNode | Keys.Result;
}

export class PathTable extends React.Component<PathTableProps, PathTableState> {
  constructor(props: PathTableProps) {
    super(props);
    this.state = { expanded: new Set<string>(), selectedItem: undefined };
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
  }

  /**
   * Given a list of `ids`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  toggle(e: React.MouseEvent, keys: Keys.ResultKey[]) {
    const keyStrings = keys.map(Keys.keyToString);
    this.setState(previousState => {
      const expanded = new Set(previousState.expanded);
      if (previousState.expanded.has(keyStrings[0])) {
        expanded.delete(keyStrings[0]);
      } else {
        for (const str of keyStrings) {
          expanded.add(str);
        }
      }
      return { expanded };
    });
    e.stopPropagation();
    e.preventDefault();
  }

  sortClass(column: InterpretedResultsSortColumn): string {
    const sortState = this.props.resultSet.interpretation.data.sortState;
    if (sortState !== undefined && sortState.sortBy === column) {
      return sortState.sortDirection === SortDirection.asc ? 'sort-asc' : 'sort-desc';
    }
    else {
      return 'sort-none';
    }
  }

  getNextSortState(column: InterpretedResultsSortColumn): InterpretedResultsSortState | undefined {
    const oldSortState = this.props.resultSet.interpretation.data.sortState;
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

  renderNoResults(): JSX.Element {
    if (this.props.nonemptyRawResults) {
      return <span>No Alerts. See <a href='#' onClick={this.props.showRawResults}>raw results</a>.</span>;
    } else {
      return emptyQueryResultsMessage();
    }
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
    const { numTruncatedResults, sourceLocationPrefix } = resultSet.interpretation;

    function renderRelatedLocations(msg: string, relatedLocations: Sarif.Location[], resultKey: Keys.PathNode | Keys.Result | undefined): JSX.Element[] {
      const relatedLocationsById: { [k: string]: Sarif.Location } = {};
      for (const loc of relatedLocations) {
        relatedLocationsById[loc.id!] = loc;
      }

      // match things like `[link-text](related-location-id)`
      const parts = parseSarifPlainTextMessage(msg);

      return parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{part}</span>;
        } else {
          const renderedLocation = renderSarifLocationWithText(part.text, relatedLocationsById[part.dest],
            resultKey);
          return <span key={i}>{renderedLocation}</span>;
        }
      });
    }

    function renderNonLocation(msg: string | undefined, locationHint: string): JSX.Element | undefined {
      if (msg == undefined)
        return undefined;
      return <span title={locationHint}>{msg}</span>;
    }

    const updateSelectionCallback = (resultKey: Keys.PathNode | Keys.Result | undefined) => {
      return () => {
        this.setState(previousState => ({
          ...previousState,
          selectedItem: resultKey
        }));
      };
    };

    function renderSarifLocationWithText(text: string | undefined, loc: Sarif.Location, resultKey: Keys.PathNode | Keys.Result | undefined): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc, sourceLocationPrefix);
      if ('hint' in parsedLoc) {
        return renderNonLocation(text, parsedLoc.hint);
      } else if (isWholeFileLoc(parsedLoc) || isLineColumnLoc(parsedLoc)) {
        return renderLocation(
          parsedLoc,
          text,
          databaseUri,
          undefined,
          updateSelectionCallback(resultKey)
        );
      } else {
        return undefined;
      }
    }

    /**
     * Render sarif location as a link with the text being simply a
     * human-readable form of the location itself.
     */
    function renderSarifLocation(
      loc: Sarif.Location,
      pathNodeKey: Keys.PathNode | Keys.Result | undefined
    ): JSX.Element | undefined {
      const parsedLoc = parseSarifLocation(loc, sourceLocationPrefix);
      if ('hint' in parsedLoc) {
        return renderNonLocation('[no location]', parsedLoc.hint);
      } else if (isWholeFileLoc(parsedLoc)) {
        const shortLocation = `${path.basename(parsedLoc.userVisibleFile)}`;
        const longLocation = `${parsedLoc.userVisibleFile}`;
        return renderLocation(
          parsedLoc,
          shortLocation,
          databaseUri,
          longLocation,
          updateSelectionCallback(pathNodeKey)
        );
      } else if (isLineColumnLoc(parsedLoc)) {
        const shortLocation = `${path.basename(parsedLoc.userVisibleFile)}:${parsedLoc.startLine}:${parsedLoc.startColumn}`;
        const longLocation = `${parsedLoc.userVisibleFile}`;
        return renderLocation(
          parsedLoc,
          shortLocation,
          databaseUri,
          longLocation,
          updateSelectionCallback(pathNodeKey)
        );
      } else {
        return undefined;
      }
    }

    const toggler: (keys: Keys.ResultKey[]) => (e: React.MouseEvent) => void = (indices) => {
      return (e) => this.toggle(e, indices);
    };

    if (!resultSet.interpretation.data.runs?.[0]?.results?.length) {
      return this.renderNoResults();
    }

    resultSet.interpretation.data.runs[0].results.forEach((result, resultIndex) => {
      const resultKey: Keys.Result = { resultIndex };
      const text = result.message.text || '[no text]';
      const msg: JSX.Element[] =
        result.relatedLocations === undefined ?
          [<span key="0">{text}</span>] :
          renderRelatedLocations(text, result.relatedLocations, resultKey);

      const currentResultExpanded = this.state.expanded.has(Keys.keyToString(resultKey));
      const indicator = currentResultExpanded ? octicons.chevronDown : octicons.chevronRight;
      const location = result.locations !== undefined && result.locations.length > 0 &&
        renderSarifLocation(result.locations[0], resultKey);
      const locationCells = <td className="vscode-codeql__location-cell">{location}</td>;

      const selectedItem = this.state.selectedItem;
      const resultRowIsSelected = selectedItem?.resultIndex === resultIndex && selectedItem.pathIndex === undefined;

      if (result.codeFlows === undefined) {
        rows.push(
          <tr key={resultIndex} {...selectableZebraStripe(resultRowIsSelected, resultIndex)}>
            <td className="vscode-codeql__icon-cell">{octicons.info}</td>
            <td colSpan={3}>{msg}</td>
            {locationCells}
          </tr>
        );
      }
      else {
        const paths: Sarif.ThreadFlow[] = Keys.getAllPaths(result);

        const indices = paths.length == 1 ?
          [resultKey, { ...resultKey, pathIndex: 0 }] : /* if there's exactly one path, auto-expand
                                                         * the path when expanding the result */
          [resultKey];

        rows.push(
          <tr {...selectableZebraStripe(resultRowIsSelected, resultIndex)} key={resultIndex}>
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

        paths.forEach((path, pathIndex) => {
          const pathKey = { resultIndex, pathIndex };
          const currentPathExpanded = this.state.expanded.has(Keys.keyToString(pathKey));
          if (currentResultExpanded) {
            const indicator = currentPathExpanded ? octicons.chevronDown : octicons.chevronRight;
            rows.push(
              <tr {...zebraStripe(resultIndex)} key={`${resultIndex}-${pathIndex}`}>
                <td className="vscode-codeql__icon-cell"><span className="vscode-codeql__vertical-rule"></span></td>
                <td className="vscode-codeql__icon-cell vscode-codeql__dropdown-cell" onMouseDown={toggler([pathKey])}>{indicator}</td>
                <td className="vscode-codeql__text-center" colSpan={3}>
                  Path
                </td>
              </tr>
            );
          }

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
              const isSelected = Keys.equalsNotUndefined(this.state.selectedItem, pathNodeKey);
              const stepIndex = pathNodeIndex + 1; // Convert to 1-based
              const zebraIndex = resultIndex + stepIndex;
              rows.push(
                <tr className={isSelected ? 'vscode-codeql__selected-path-node' : undefined} key={`${resultIndex}-${pathIndex}-${pathNodeIndex}`}>
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
      rows.push(
        <tr key="truncatd-message">
          <td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic' }}>
            Too many results to show at once. {numTruncatedResults} result(s) omitted.
          </td>
        </tr>
      );
    }

    return <table className={className}>
      {header}
      <tbody>{rows}</tbody>
    </table>;
  }

  private handleNavigationEvent(event: NavigationEvent) {
    switch (event.t) {
      case 'navigatePath': {
        this.handleNavigatePathStepEvent(event);
        break;
      }
      case 'navigateAlert': {
        this.handleNavigateAlertEvent(event);
        break;
      }
    }
  }

  private handleNavigatePathStepEvent(event: NavigatePathMsg) {
    this.setState(prevState => {
      const { selectedItem } = prevState;
      if (selectedItem === undefined) return prevState;

      const selectedPath = selectedItem.pathIndex !== undefined
        ? selectedItem
        : { ...selectedItem, pathIndex: 0 };

      const path = Keys.getPath(this.props.resultSet.interpretation.data, selectedPath);
      if (path === undefined) return prevState;

      const nextIndex = selectedItem.pathNodeIndex !== undefined
        ? (selectedItem.pathNodeIndex + event.direction)
        : 0;
      if (nextIndex < 0 || nextIndex >= path.locations.length) return prevState;

      const sarifLoc = path.locations[nextIndex].location;
      if (sarifLoc === undefined) {
        return prevState;
      }

      const loc = parseSarifLocation(sarifLoc, this.props.resultSet.interpretation.sourceLocationPrefix);
      if (isNoLocation(loc)) {
        return prevState;
      }

      jumpToLocation(loc, this.props.databaseUri);
      const newSelection = { ...selectedPath, pathNodeIndex: nextIndex };
      return { ...prevState, selectedItem: newSelection };
    });
  }

  private handleNavigateAlertEvent(event: NavigateAlertMsg) {
    this.setState(prevState => {
      const { selectedItem } = prevState;
      if (selectedItem === undefined) return prevState;

      const nextIndex = selectedItem.resultIndex + event.direction;
      const nextSelection = { resultIndex: nextIndex };
      const result = Keys.getResult(this.props.resultSet.interpretation.data, nextSelection);
      if (result === undefined) {
        return prevState;
      }

      const sarifLoc = result.locations?.[0];
      if (sarifLoc === undefined) {
        return prevState;
      }

      const loc = parseSarifLocation(sarifLoc, this.props.resultSet.interpretation.sourceLocationPrefix);
      if (isNoLocation(loc)) {
        return prevState;
      }

      jumpToLocation(loc, this.props.databaseUri);
      return { ...prevState, selectedItem: nextSelection };
    });
  }

  componentDidMount() {
    onNavigation.addListener(this.handleNavigationEvent);
  }

  componentWillUnmount() {
    onNavigation.removeListener(this.handleNavigationEvent);
  }
}
