import * as React from 'react';
import * as Rdom from 'react-dom';
import * as bqrs from 'semmle-bqrs';
import { ElementBase, PrimitiveColumnValue, PrimitiveTypeKind, ResultSetSchema, tryGetResolvableLocation } from 'semmle-bqrs';
import { assertNever } from '../helpers-pure';
import { DatabaseInfo, FromResultsViewMsg, Interpretation, IntoResultsViewMsg, SortedResultSetInfo, RawResultsSortState, NavigatePathMsg, QueryMetadata, ResultsPaths } from '../interface-types';
import { EventHandlers as EventHandlerList } from './event-handler-list';
import { ResultTables } from './result-tables';
import { RawResultSet, ResultValue, ResultRow } from '../adapt';

/**
 * results.tsx
 * -----------
 *
 * Displaying query results.
 */

interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(msg: FromResultsViewMsg): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();

export type RawTableResultSet = { t: 'RawResultSet' } & RawResultSet;
export type PathTableResultSet = { t: 'SarifResultSet'; readonly schema: ResultSetSchema; name: string } & Interpretation;

export type ResultSet =
  | RawTableResultSet
  | PathTableResultSet;

async function* getChunkIterator(response: Response): AsyncIterableIterator<Uint8Array> {
  if (!response.ok) {
    throw new Error(`Failed to load results: (${response.status}) ${response.statusText}`);
  }
  const reader = response.body!.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    yield value!;
  }
}

function translatePrimitiveValue(value: PrimitiveColumnValue, type: PrimitiveTypeKind): ResultValue {
  switch (type) {
    case 'i':
    case 'f':
    case 's':
    case 'd':
    case 'b':
      return value.toString();

    case 'u':
      return {
        uri: value as string
      };
  }
}

async function parseResultSets(response: Response): Promise<readonly ResultSet[]> {
  const chunks = getChunkIterator(response);

  const resultSets: ResultSet[] = [];

  await bqrs.parse(chunks, (resultSetSchema) => {
    const columnTypes = resultSetSchema.columns.map((column) => column.type);
    const rows: ResultRow[] = [];
    resultSets.push({
      t: 'RawResultSet',
      schema: resultSetSchema,
      rows: rows
    });

    return (tuple) => {
      const row: ResultValue[] = [];
      tuple.forEach((value, index) => {
        const type = columnTypes[index];
        if (type.type === 'e') {
          const element: ElementBase = value as ElementBase;
          const label = (element.label !== undefined) ? element.label : element.id.toString(); //REVIEW: URLs?
          const resolvableLocation = tryGetResolvableLocation(element.location);
          if (resolvableLocation !== undefined) {
            row.push({
              label: label,
              location: resolvableLocation
            });
          }
          else {
            // No location link.
            row.push(label);
          }
        }
        else {
          row.push(translatePrimitiveValue(value as PrimitiveColumnValue, type.type));
        }
      });

      rows.push(row);
    };
  });

  return resultSets;
}

interface ResultsInfo {
  resultsPath: string;
  resultSets: ResultSet[] | undefined;
  origResultsPaths: ResultsPaths;
  database: DatabaseInfo;
  interpretation: Interpretation | undefined;
  sortedResultsMap: Map<string, SortedResultSetInfo>;
  /**
   * See {@link SetStateMsg.shouldKeepOldResultsWhileRendering}.
   */
  shouldKeepOldResultsWhileRendering: boolean;
  metadata?: QueryMetadata;
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

export type NavigationEvent = NavigatePathMsg;

/**
 * Event handlers to be notified of navigation events coming from outside the webview.
 */
export const onNavigation = new EventHandlerList<NavigationEvent>();

/**
 * A minimal state container for displaying results.
 */
class App extends React.Component<{}, ResultsViewState> {
  constructor(props: any) {
    super(props);
    this.state = {
      displayedResults: {
        resultsInfo: null,
        results: null,
        errorMessage: ''
      },
      nextResultsInfo: null,
      isExpectingResultsUpdate: true
    };
  }

  handleMessage(msg: IntoResultsViewMsg): void {
    switch (msg.t) {
      case 'setState':
        this.updateStateWithNewResultsInfo({
          resultsPath: msg.resultsPath,
          resultSets: msg.resultSets?.map(x => ({ t: 'RawResultSet', ...x })),
          origResultsPaths: msg.origResultsPaths,
          sortedResultsMap: new Map(Object.entries(msg.sortedResultsMap)),
          database: msg.database,
          interpretation: msg.interpretation,
          shouldKeepOldResultsWhileRendering: msg.shouldKeepOldResultsWhileRendering,
          metadata: msg.metadata
        });

        this.loadResults();
        break;
      case 'resultsUpdating':
        this.setState({
          isExpectingResultsUpdate: true
        });
        break;
      case 'navigatePath':
        onNavigation.fire(msg);
        break;
      default:
        assertNever(msg);
    }
  }

  private updateStateWithNewResultsInfo(resultsInfo: ResultsInfo): void {
    this.setState(prevState => {
      const stateWithDisplayedResults = (displayedResults: ResultsState): ResultsViewState => ({
        displayedResults,
        isExpectingResultsUpdate: prevState.isExpectingResultsUpdate,
        nextResultsInfo: resultsInfo
      });

      if (!prevState.isExpectingResultsUpdate && resultsInfo === null) {
        // No results to display
        return stateWithDisplayedResults({
          resultsInfo: null,
          results: null,
          errorMessage: 'No results to display'
        });
      }
      if (!resultsInfo || !resultsInfo.shouldKeepOldResultsWhileRendering) {
        // Display loading message
        return stateWithDisplayedResults({
          resultsInfo: null,
          results: null,
          errorMessage: 'Loading results…'
        });
      }
      return stateWithDisplayedResults(prevState.displayedResults);
    });
  }

  private async loadResults(): Promise<void> {
    const resultsInfo = this.state.nextResultsInfo;
    if (resultsInfo === null) {
      return;
    }

    let results: Results | null = null;
    let statusText = '';
    try {
      const resultSets = resultsInfo.resultSets || await this.getResultSets(resultsInfo);
      results = {
        resultSets,
        database: resultsInfo.database,
        sortStates: this.getSortStates(resultsInfo)
      };
    }
    catch (e) {
      let errorMessage: string;
      if (e instanceof Error) {
        errorMessage = e.message;
      } else {
        errorMessage = 'Unknown error';
      }

      statusText = `Error loading results: ${errorMessage}`;
    }

    this.setState(prevState => {
      // Only set state if this results info is still current.
      if (resultsInfo !== prevState.nextResultsInfo) {
        return null;
      }
      return {
        displayedResults: {
          resultsInfo,
          results,
          errorMessage: statusText
        },
        nextResultsInfo: null,
        isExpectingResultsUpdate: false
      }
    });
  }

  private async getResultSets(resultsInfo: ResultsInfo): Promise<readonly ResultSet[]> {
    const unsortedResponse = await fetch(resultsInfo.resultsPath);
    const unsortedResultSets = await parseResultSets(unsortedResponse);
    return Promise.all(unsortedResultSets.map(async unsortedResultSet => {
      const sortedResultSetInfo = resultsInfo.sortedResultsMap.get(unsortedResultSet.schema.name);
      if (sortedResultSetInfo === undefined) {
        return unsortedResultSet;
      }
      const response = await fetch(sortedResultSetInfo.resultsPath);
      const resultSets = await parseResultSets(response);
      if (resultSets.length != 1) {
        throw new Error(`Expected sorted BQRS to contain a single result set, encountered ${resultSets.length} result sets.`);
      }
      return resultSets[0];
    }));
  }

  private getSortStates(resultsInfo: ResultsInfo): Map<string, RawResultsSortState> {
    const entries = Array.from(resultsInfo.sortedResultsMap.entries());
    return new Map(entries.map(([key, sortedResultSetInfo]) =>
      [key, sortedResultSetInfo.sortState]));
  }

  render(): JSX.Element {
    const displayedResults = this.state.displayedResults;
    if (displayedResults.results !== null && displayedResults.resultsInfo !== null) {
      return <ResultTables rawResultSets={displayedResults.results.resultSets}
        interpretation={displayedResults.resultsInfo ? displayedResults.resultsInfo.interpretation : undefined}
        database={displayedResults.results.database}
        origResultsPaths={displayedResults.resultsInfo.origResultsPaths}
        resultsPath={displayedResults.resultsInfo.resultsPath}
        metadata={displayedResults.resultsInfo ? displayedResults.resultsInfo.metadata : undefined}
        sortStates={displayedResults.results.sortStates}
        interpretedSortState={displayedResults.resultsInfo.interpretation?.sortState}
        isLoadingNewResults={this.state.isExpectingResultsUpdate || this.state.nextResultsInfo !== null} />;
    }
    else {
      return <span>{displayedResults.errorMessage}</span>;
    }
  }

  componentDidMount(): void {
    this.vscodeMessageHandler = evt => this.handleMessage(evt.data as IntoResultsViewMsg);
    window.addEventListener('message', this.vscodeMessageHandler);
  }

  componentWillUnmount(): void {
    if (this.vscodeMessageHandler) {
      window.removeEventListener('message', this.vscodeMessageHandler);
    }
  }

  private vscodeMessageHandler: ((ev: MessageEvent) => void) | undefined = undefined;
}

Rdom.render(
  <App />,
  document.getElementById('root')
);

vscode.postMessage({ t: "resultViewLoaded" })
