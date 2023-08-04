import * as React from "react";
import { assertNever, getErrorMessage } from "../../common/helpers-pure";
import {
  DatabaseInfo,
  Interpretation,
  IntoResultsViewMsg,
  SortedResultSetInfo,
  RawResultsSortState,
  QueryMetadata,
  ResultsPaths,
  ALERTS_TABLE_NAME,
  GRAPH_TABLE_NAME,
  ParsedResultSets,
  NavigateMsg,
  ResultSet,
} from "../../common/interface-types";
import { EventHandlers as EventHandlerList } from "./event-handler-list";
import { ResultTables } from "./ResultTables";

import "./resultsView.css";
import { useCallback, useEffect } from "react";

/**
 * results.tsx
 * -----------
 *
 * Displaying query results.
 */

interface ResultsInfo {
  parsedResultSets: ParsedResultSets;
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  database: DatabaseInfo;
  interpretation: Interpretation | undefined;
  sortedResultsMap: Map<string, SortedResultSetInfo>;
  /**
   * See {@link SetStateMsg.shouldKeepOldResultsWhileRendering}.
   */
  shouldKeepOldResultsWhileRendering: boolean;
  metadata?: QueryMetadata;
  queryName: string;
  queryPath: string;
}

interface Results {
  resultSets: readonly ResultSet[];
  sortStates: Map<string, RawResultsSortState>;
  database: DatabaseInfo;
}

interface ResultsState {
  // We use `null` instead of `undefined` here because in React, `undefined` is
  // used to mean "did not change" when updating the state of a component.
  resultsInfo: ResultsInfo | null;
  results: Results | null;
  errorMessage: string;
}

interface ResultsViewState {
  displayedResults: ResultsState;
  nextResultsInfo: ResultsInfo | null;
  isExpectingResultsUpdate: boolean;
}

/**
 * Event handlers to be notified of navigation events coming from outside the webview.
 */
export const onNavigation = new EventHandlerList<NavigateMsg>();

/**
 * A minimal state container for displaying results.
 */
export function ResultsApp() {
  const [state, setState] = React.useState<ResultsViewState>({
    displayedResults: {
      resultsInfo: null,
      results: null,
      errorMessage: "",
    },
    nextResultsInfo: null,
    isExpectingResultsUpdate: true,
  });

  const updateStateWithNewResultsInfo = useCallback(
    (resultsInfo: ResultsInfo): void => {
      setState((prevState) => {
        if (resultsInfo === null && prevState.isExpectingResultsUpdate) {
          // Display loading message
          return {
            ...prevState,
            displayedResults: {
              resultsInfo: null,
              results: null,
              errorMessage: "Loading results…",
            },
            nextResultsInfo: resultsInfo,
          };
        } else if (resultsInfo === null) {
          // No results to display
          return {
            ...prevState,
            displayedResults: {
              resultsInfo: null,
              results: null,
              errorMessage: "No results to display",
            },
            nextResultsInfo: resultsInfo,
          };
        }

        let results: Results | null = null;
        let statusText = "";
        try {
          const resultSets = getResultSets(resultsInfo);
          results = {
            resultSets,
            database: resultsInfo.database,
            sortStates: getSortStates(resultsInfo),
          };
        } catch (e) {
          const errorMessage = getErrorMessage(e);

          statusText = `Error loading results: ${errorMessage}`;
        }

        return {
          displayedResults: {
            resultsInfo,
            results,
            errorMessage: statusText,
          },
          nextResultsInfo: null,
          isExpectingResultsUpdate: false,
        };
      });
    },
    [],
  );

  const handleMessage = useCallback(
    (msg: IntoResultsViewMsg): void => {
      switch (msg.t) {
        case "setState":
          updateStateWithNewResultsInfo({
            resultsPath: msg.resultsPath,
            parsedResultSets: msg.parsedResultSets,
            origResultsPaths: msg.origResultsPaths,
            sortedResultsMap: new Map(Object.entries(msg.sortedResultsMap)),
            database: msg.database,
            interpretation: msg.interpretation,
            shouldKeepOldResultsWhileRendering:
              msg.shouldKeepOldResultsWhileRendering,
            metadata: msg.metadata,
            queryName: msg.queryName,
            queryPath: msg.queryPath,
          });

          break;
        case "showInterpretedPage": {
          const tableName =
            msg.interpretation.data.t === "GraphInterpretationData"
              ? GRAPH_TABLE_NAME
              : ALERTS_TABLE_NAME;

          updateStateWithNewResultsInfo({
            resultsPath: "", // FIXME: Not used for interpreted, refactor so this is not needed
            parsedResultSets: {
              numPages: msg.numPages,
              pageSize: msg.pageSize,
              numInterpretedPages: msg.numPages,
              resultSetNames: msg.resultSetNames,
              pageNumber: msg.pageNumber,
              resultSet: {
                t: "InterpretedResultSet",
                name: tableName,
                schema: {
                  name: tableName,
                  rows: 1,
                  columns: [],
                },
                interpretation: msg.interpretation,
              },
              selectedTable: tableName,
            },
            origResultsPaths: undefined as any, // FIXME: Not used for interpreted, refactor so this is not needed
            sortedResultsMap: new Map(), // FIXME: Not used for interpreted, refactor so this is not needed
            database: msg.database,
            interpretation: msg.interpretation,
            shouldKeepOldResultsWhileRendering: true,
            metadata: msg.metadata,
            queryName: msg.queryName,
            queryPath: msg.queryPath,
          });
          break;
        }
        case "resultsUpdating":
          setState((prevState) => ({
            ...prevState,
            isExpectingResultsUpdate: true,
          }));
          break;
        case "navigate":
          onNavigation.fire(msg);
          break;

        case "untoggleShowProblems":
          // noop
          break;

        default:
          assertNever(msg);
      }
    },
    [updateStateWithNewResultsInfo],
  );

  const vscodeMessageHandler = useCallback(
    (evt: MessageEvent) => {
      // sanitize origin
      const origin = evt.origin.replace(/\n|\r/g, "");
      evt.origin === window.origin
        ? handleMessage(evt.data as IntoResultsViewMsg)
        : console.error(`Invalid event origin ${origin}`);
    },
    [handleMessage],
  );

  useEffect(() => {
    window.addEventListener("message", vscodeMessageHandler);
    return () => {
      window.removeEventListener("message", vscodeMessageHandler);
    };
  }, [vscodeMessageHandler]);

  const { displayedResults, nextResultsInfo, isExpectingResultsUpdate } = state;
  if (
    displayedResults.results !== null &&
    displayedResults.resultsInfo !== null
  ) {
    const parsedResultSets = displayedResults.resultsInfo.parsedResultSets;
    const key =
      (parsedResultSets.selectedTable || "") + parsedResultSets.pageNumber;
    const data = displayedResults.resultsInfo.interpretation?.data;

    return (
      <ResultTables
        key={key}
        parsedResultSets={parsedResultSets}
        rawResultSets={displayedResults.results.resultSets}
        interpretation={
          displayedResults.resultsInfo
            ? displayedResults.resultsInfo.interpretation
            : undefined
        }
        database={displayedResults.results.database}
        origResultsPaths={displayedResults.resultsInfo.origResultsPaths}
        resultsPath={displayedResults.resultsInfo.resultsPath}
        metadata={
          displayedResults.resultsInfo
            ? displayedResults.resultsInfo.metadata
            : undefined
        }
        sortStates={displayedResults.results.sortStates}
        interpretedSortState={
          data?.t === "SarifInterpretationData" ? data.sortState : undefined
        }
        isLoadingNewResults={
          isExpectingResultsUpdate || nextResultsInfo !== null
        }
        queryName={displayedResults.resultsInfo.queryName}
        queryPath={displayedResults.resultsInfo.queryPath}
      />
    );
  } else {
    return <span>{displayedResults.errorMessage}</span>;
  }
}

function getSortStates(
  resultsInfo: ResultsInfo,
): Map<string, RawResultsSortState> {
  const entries = Array.from(resultsInfo.sortedResultsMap.entries());
  return new Map(
    entries.map(([key, sortedResultSetInfo]) => [
      key,
      sortedResultSetInfo.sortState,
    ]),
  );
}

function getResultSets(resultsInfo: ResultsInfo): readonly ResultSet[] {
  const parsedResultSets = resultsInfo.parsedResultSets;
  const resultSet = parsedResultSets.resultSet;
  if (
    resultSet.t !== "InterpretedResultSet" &&
    resultSet.t !== "RawResultSet"
  ) {
    throw new Error(
      `Invalid result set type. Should be either "InterpretedResultSet" or "RawResultSet", but got "${
        (resultSet as { t: string }).t
      }".`,
    );
  }
  return [resultSet];
}
