import * as React from "react";
import * as Sarif from "sarif";
import * as Keys from "./result-keys";
import { className, jumpToLocation } from "./result-table-utils";
import { onNavigation } from "./ResultsApp";
import { NavigateMsg, NavigationDirection } from "../../common/interface-types";
import { parseSarifLocation, isNoLocation } from "../../common/sarif-utils";
import { sendTelemetry } from "../common/telemetry";
import { AlertTableTruncatedMessage } from "./AlertTableTruncatedMessage";
import { AlertTableResultRow } from "./AlertTableResultRow";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useScrollIntoView } from "./useScrollIntoView";

type Props = {
  results: Sarif.Result[];
  databaseUri: string;
  sourceLocationPrefix: string;
  numTruncatedResults?: number;

  header: ReactNode;
  noResults?: ReactNode;
};

export function AlertTable({
  results,
  databaseUri,
  sourceLocationPrefix,
  numTruncatedResults,
  header,
  noResults,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set<string>());
  const [selectedItem, setSelectedItem] = useState<Keys.ResultKey | undefined>(
    undefined,
  );

  const selectedItemRef = useRef<any>();
  useScrollIntoView(selectedItem, selectedItemRef);

  /**
   * Given a list of `keys`, toggle the first, and if we 'open' the
   * first item, open all the rest as well. This mimics vscode's file
   * explorer tree view behavior.
   */
  const toggle = useCallback((e: React.MouseEvent, keys: Keys.ResultKey[]) => {
    const keyStrings = keys.map(Keys.keyToString);
    setExpanded((previousExpanded) => {
      const expanded = new Set(previousExpanded);
      if (previousExpanded.has(keyStrings[0])) {
        expanded.delete(keyStrings[0]);
      } else {
        for (const str of keyStrings) {
          expanded.add(str);
        }
      }
      if (expanded) {
        sendTelemetry("local-results-alert-table-path-expanded");
      }
      return expanded;
    });
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const getNewSelection = (
    key: Keys.ResultKey | undefined,
    direction: NavigationDirection,
  ): Keys.ResultKey => {
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
  };

  const handleNavigationEvent = useCallback(
    (event: NavigateMsg) => {
      const key = getNewSelection(selectedItem, event.direction);

      // Check if the selected node actually exists (bounds check) and get its location if relevant
      let jumpLocation: Sarif.Location | undefined;
      if (key.pathNodeIndex !== undefined) {
        jumpLocation = Keys.getPathNode(results, key);
        if (jumpLocation === undefined) {
          return; // Result does not exist
        }
      } else if (key.pathIndex !== undefined) {
        if (Keys.getPath(results, key) === undefined) {
          return; // Path does not exist
        }
        jumpLocation = undefined; // When selecting a 'path', don't jump anywhere.
      } else {
        jumpLocation = Keys.getResult(results, key)?.locations?.[0];
        if (jumpLocation === undefined) {
          return; // Path step does not exist.
        }
      }
      if (jumpLocation !== undefined) {
        const parsedLocation = parseSarifLocation(
          jumpLocation,
          sourceLocationPrefix,
        );
        if (!isNoLocation(parsedLocation)) {
          jumpToLocation(parsedLocation, databaseUri);
        }
      }

      const newExpanded = new Set(expanded);
      if (event.direction === NavigationDirection.right) {
        // When stepping right, expand to ensure the selected node is visible
        newExpanded.add(Keys.keyToString({ resultIndex: key.resultIndex }));
        if (key.pathIndex !== undefined) {
          newExpanded.add(
            Keys.keyToString({
              resultIndex: key.resultIndex,
              pathIndex: key.pathIndex,
            }),
          );
        }
      } else if (event.direction === NavigationDirection.left) {
        // When stepping left, collapse immediately
        newExpanded.delete(Keys.keyToString(key));
      } else {
        // When stepping up or down, collapse the previous node
        if (selectedItem !== undefined) {
          newExpanded.delete(Keys.keyToString(selectedItem));
        }
      }
      setExpanded(newExpanded);
      setSelectedItem(key);
    },
    [databaseUri, expanded, results, sourceLocationPrefix, selectedItem],
  );

  useEffect(() => {
    onNavigation.addListener(handleNavigationEvent);
    return () => {
      onNavigation.removeListener(handleNavigationEvent);
    };
  }, [handleNavigationEvent]);

  const updateSelectionCallback = useCallback(
    (resultKey: Keys.PathNode | Keys.Result | undefined) => {
      setSelectedItem(resultKey);
      sendTelemetry("local-results-alert-table-path-selected");
    },
    [],
  );

  if (!results?.length) {
    return <>{noResults}</>;
  }

  return (
    <table className={className}>
      {header}
      <tbody>
        {results.map((result, resultIndex) => (
          <AlertTableResultRow
            key={resultIndex}
            result={result}
            resultIndex={resultIndex}
            expanded={expanded}
            selectedItem={selectedItem}
            selectedItemRef={selectedItemRef}
            databaseUri={databaseUri}
            sourceLocationPrefix={sourceLocationPrefix}
            updateSelectionCallback={updateSelectionCallback}
            toggleExpanded={toggle}
          />
        ))}
        {numTruncatedResults ? (
          <AlertTableTruncatedMessage
            numTruncatedResults={numTruncatedResults}
          />
        ) : undefined}
      </tbody>
    </table>
  );
}
