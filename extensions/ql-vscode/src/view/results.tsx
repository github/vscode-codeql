import * as React from 'react';
import * as Rdom from 'react-dom';
import * as bqrs from 'semmle-bqrs';
import { ElementBase, LocationValue, PrimitiveColumnValue, PrimitiveTypeKind, ResultSetSchema, tryGetResolvableLocation } from 'semmle-bqrs';
import { assertNever } from '../helpers-pure';
import { DatabaseInfo, FromResultsViewMsg, Interpretation, IntoResultsViewMsg, SortedResultSetInfo, SortState } from '../interface-types';
import { ResultTables } from './result-tables';

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

export interface ResultElement {
  label: string,
  location?: LocationValue
}

export interface ResultUri {
  uri: string;
}

export type ResultValue = ResultElement | ResultUri | string;

export type ResultRow = ResultValue[];

export type RawTableResultSet = { t: 'RawResultSet' } & RawResultSet;
export type PathTableResultSet = { t: 'SarifResultSet', readonly schema: ResultSetSchema, name: string } & Interpretation;

export type ResultSet =
  | RawTableResultSet
  | PathTableResultSet;

export interface RawResultSet {
  readonly schema: ResultSetSchema;
  readonly rows: readonly ResultRow[];
}

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
    yield value;
  }
}

function translatePrimitiveValue(value: PrimitiveColumnValue, type: PrimitiveTypeKind):
  ResultValue {

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
  kind: string | undefined;
  database: DatabaseInfo;
  interpretation: Interpretation | undefined;
  sortedResultsMap: Map<string, SortedResultSetInfo>;
  /**
   * See {@link SetStateMsg.shouldKeepOldResultsWhileRendering}.
   */
  shouldKeepOldResultsWhileRendering: boolean;
}

interface Results {
  resultSets: readonly ResultSet[];
  sortStates: Map<string, SortState>;
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
          kind: msg.kind,
          sortedResultsMap: new Map(Object.entries(msg.sortedResultsMap)),
          database: msg.database,
          interpretation: msg.interpretation,
          shouldKeepOldResultsWhileRendering: msg.shouldKeepOldResultsWhileRendering
        });

        this.loadResults();
        break;
      case 'resultsUpdating':
        this.setState({
          isExpectingResultsUpdate: true
        });
        break;
      default:
        assertNever(msg);
    }
  }

  private updateStateWithNewResultsInfo(resultsInfo: ResultsInfo): void {
    this.setState(prevState => {
      const stateWithDisplayedResults = (displayedResults: ResultsState) => ({
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
    let statusText: string = '';
    try {
      results = {
        resultSets: await this.getResultSets(resultsInfo),
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

  private getSortStates(resultsInfo: ResultsInfo): Map<string, SortState> {
    const entries = Array.from(resultsInfo.sortedResultsMap.entries());
    return new Map(entries.map(([key, sortedResultSetInfo]) =>
      [key, sortedResultSetInfo.sortState]));
  }

  render() {
    const displayedResults = this.state.displayedResults;
    if (displayedResults.results !== null) {
      return <ResultTables rawResultSets={displayedResults.results.resultSets}
        interpretation={displayedResults.resultsInfo ? displayedResults.resultsInfo.interpretation : undefined}
        database={displayedResults.results.database}
        resultsPath={displayedResults.resultsInfo ? displayedResults.resultsInfo.resultsPath : undefined}
        kind={displayedResults.resultsInfo ? displayedResults.resultsInfo.kind : undefined}
        sortStates={displayedResults.results.sortStates}
        isLoadingNewResults={this.state.isExpectingResultsUpdate || this.state.nextResultsInfo !== null} />;
    }
    else {
      return <span>{displayedResults.errorMessage}</span>;
    }
  }

  componentDidMount() {
    this.vscodeMessageHandler = evt => this.handleMessage(evt.data as IntoResultsViewMsg);
    window.addEventListener('message', this.vscodeMessageHandler);
  }

  componentWillUnmount() {
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