import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import {
  className,
  ResultTableProps,
  jumpToLocation,
} from "./result-table-utils";
import { onNavigation } from "./ResultsApp";
import {
  InterpretedResultSet,
  NavigateMsg,
  NavigationDirection,
  SarifInterpretationData,
} from "../../common/interface-types";
import { parseSarifLocation, isNoLocation } from "../../common/sarif-utils";
import { ScrollIntoViewHelper } from "./scroll-into-view-helper";
import { sendTelemetry } from "../common/telemetry";
import { AlertTableHeader } from "./AlertTableHeader";
import { SarifMessageWithLocations } from "./locations/SarifMessageWithLocations";
import { AlertTableNoResults } from "./AlertTableNoResults";
import { AlertTableTruncatedMessage } from "./AlertTableTruncatedMessage";
import { AlertTablePathRow } from "./AlertTablePathRow";
import { AlertTableResultRow } from "./AlertTableResultRow";

type AlertTableProps = ResultTableProps & {
  resultSet: InterpretedResultSet<SarifInterpretationData>;
};
interface AlertTableState {
  expanded: Set<string>;
  selectedItem: undefined | Keys.ResultKey;
}

export class AlertTable extends React.Component<
  AlertTableProps,
  AlertTableState
> {
  private scroller = new ScrollIntoViewHelper();

  constructor(props: AlertTableProps) {
    super(props);
    this.state = { expanded: new Set<string>(), selectedItem: undefined };
    this.handleNavigationEvent = this.handleNavigationEvent.bind(this);
  }

  /**
   * Given a list of `keys`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  toggle(e: React.MouseEvent, keys: Keys.ResultKey[]) {
    const keyStrings = keys.map(Keys.keyToString);
    this.setState((previousState) => {
      const expanded = new Set(previousState.expanded);
      if (previousState.expanded.has(keyStrings[0])) {
        expanded.delete(keyStrings[0]);
      } else {
        for (const str of keyStrings) {
          expanded.add(str);
        }
      }
      if (expanded) {
        sendTelemetry("local-results-alert-table-path-expanded");
      }
      return { expanded };
    });
    e.stopPropagation();
    e.preventDefault();
  }

  render(): JSX.Element {
    const { databaseUri, resultSet } = this.props;

    const { numTruncatedResults, sourceLocationPrefix } =
      resultSet.interpretation;

    const updateSelectionCallback = (
      resultKey: Keys.PathNode | Keys.Result | undefined,
    ) => {
      return () => {
        this.setState((previousState) => ({
          ...previousState,
          selectedItem: resultKey,
        }));
        sendTelemetry("local-results-alert-table-path-selected");
      };
    };

    const toggler: (keys: Keys.ResultKey[]) => (e: React.MouseEvent) => void = (
      indices,
    ) => {
      return (e) => this.toggle(e, indices);
    };

    if (!resultSet.interpretation.data.runs?.[0]?.results?.length) {
      return <AlertTableNoResults {...this.props} />;
    }

    const rows: JSX.Element[] =
      resultSet.interpretation.data.runs[0].results.map(
        (result, resultIndex) => {
          const resultKey: Keys.Result = { resultIndex };
          const text = result.message.text || "[no text]";
          const msg =
            result.relatedLocations === undefined ? (
              <span key="0">{text}</span>
            ) : (
              <SarifMessageWithLocations
                msg={text}
                relatedLocations={result.relatedLocations}
                sourceLocationPrefix={sourceLocationPrefix}
                databaseUri={databaseUri}
                onClick={updateSelectionCallback(resultKey)}
              />
            );

          const currentResultExpanded = this.state.expanded.has(
            Keys.keyToString(resultKey),
          );

          return (
            <>
              <AlertTableResultRow
                result={result}
                resultIndex={resultIndex}
                currentResultExpanded={currentResultExpanded}
                selectedItem={this.state.selectedItem}
                databaseUri={databaseUri}
                sourceLocationPrefix={sourceLocationPrefix}
                updateSelectionCallback={updateSelectionCallback}
                toggler={toggler}
                scroller={this.scroller}
                msg={msg}
              />
              {currentResultExpanded &&
                result.codeFlows &&
                Keys.getAllPaths(result).map((path, pathIndex) => (
                  <AlertTablePathRow
                    key={`${resultIndex}-${pathIndex}`}
                    path={path}
                    pathIndex={pathIndex}
                    resultIndex={resultIndex}
                    currentPathExpanded={this.state.expanded.has(
                      Keys.keyToString({ resultIndex, pathIndex }),
                    )}
                    selectedItem={this.state.selectedItem}
                    databaseUri={databaseUri}
                    sourceLocationPrefix={sourceLocationPrefix}
                    updateSelectionCallback={updateSelectionCallback}
                    toggler={toggler}
                    scroller={this.scroller}
                  />
                ))}
            </>
          );
        },
      );

    return (
      <table className={className}>
        <AlertTableHeader sortState={resultSet.interpretation.data.sortState} />
        <tbody>
          {rows}
          <AlertTableTruncatedMessage
            numTruncatedResults={numTruncatedResults}
          />
        </tbody>
      </table>
    );
  }

  private handleNavigationEvent(event: NavigateMsg) {
    this.setState((prevState) => {
      const key = this.getNewSelection(prevState.selectedItem, event.direction);
      const data = this.props.resultSet.interpretation.data;

      // Check if the selected node actually exists (bounds check) and get its location if relevant
      let jumpLocation: Sarif.Location | undefined;
      if (key.pathNodeIndex !== undefined) {
        jumpLocation = Keys.getPathNode(data, key);
        if (jumpLocation === undefined) {
          return prevState; // Result does not exist
        }
      } else if (key.pathIndex !== undefined) {
        if (Keys.getPath(data, key) === undefined) {
          return prevState; // Path does not exist
        }
        jumpLocation = undefined; // When selecting a 'path', don't jump anywhere.
      } else {
        jumpLocation = Keys.getResult(data, key)?.locations?.[0];
        if (jumpLocation === undefined) {
          return prevState; // Path step does not exist.
        }
      }
      if (jumpLocation !== undefined) {
        const parsedLocation = parseSarifLocation(
          jumpLocation,
          this.props.resultSet.interpretation.sourceLocationPrefix,
        );
        if (!isNoLocation(parsedLocation)) {
          jumpToLocation(parsedLocation, this.props.databaseUri);
        }
      }

      const expanded = new Set(prevState.expanded);
      if (event.direction === NavigationDirection.right) {
        // When stepping right, expand to ensure the selected node is visible
        expanded.add(Keys.keyToString({ resultIndex: key.resultIndex }));
        if (key.pathIndex !== undefined) {
          expanded.add(
            Keys.keyToString({
              resultIndex: key.resultIndex,
              pathIndex: key.pathIndex,
            }),
          );
        }
      } else if (event.direction === NavigationDirection.left) {
        // When stepping left, collapse immediately
        expanded.delete(Keys.keyToString(key));
      } else {
        // When stepping up or down, collapse the previous node
        if (prevState.selectedItem !== undefined) {
          expanded.delete(Keys.keyToString(prevState.selectedItem));
        }
      }
      this.scroller.scrollIntoViewOnNextUpdate();
      return {
        ...prevState,
        expanded,
        selectedItem: key,
      };
    });
  }

  private getNewSelection(
    key: Keys.ResultKey | undefined,
    direction: NavigationDirection,
  ): Keys.ResultKey {
    if (key === undefined) {
      return { resultIndex: 0 };
    }
    const { resultIndex, pathIndex, pathNodeIndex } = key;
    switch (direction) {
      case NavigationDirection.up:
      case NavigationDirection.down: {
        const delta = direction === NavigationDirection.up ? -1 : 1;
        if (key.pathNodeIndex !== undefined) {
          return {
            resultIndex,
            pathIndex: key.pathIndex,
            pathNodeIndex: key.pathNodeIndex + delta,
          };
        } else if (pathIndex !== undefined) {
          return { resultIndex, pathIndex: pathIndex + delta };
        } else {
          return { resultIndex: resultIndex + delta };
        }
      }
      case NavigationDirection.left:
        if (key.pathNodeIndex !== undefined) {
          return { resultIndex, pathIndex: key.pathIndex };
        } else if (pathIndex !== undefined) {
          return { resultIndex };
        } else {
          return key;
        }
      case NavigationDirection.right:
        if (pathIndex === undefined) {
          return { resultIndex, pathIndex: 0 };
        } else if (pathNodeIndex === undefined) {
          return { resultIndex, pathIndex, pathNodeIndex: 0 };
        } else {
          return key;
        }
    }
  }

  componentDidUpdate() {
    this.scroller.update();
  }

  componentDidMount() {
    this.scroller.update();
    onNavigation.addListener(this.handleNavigationEvent);
  }

  componentWillUnmount() {
    onNavigation.removeListener(this.handleNavigationEvent);
  }
}
