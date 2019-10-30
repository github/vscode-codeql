import * as React from 'react';
import * as Rdom from 'react-dom';
import * as bqrs from 'semmle-bqrs';
import { ElementBase, isResolvableLocation, LocationValue, PrimitiveColumnValue, PrimitiveTypeKind, ResultSetSchema } from 'semmle-bqrs';
import { assertNever } from '../helpers-pure';
import { DatabaseInfo, FromResultsViewMsg, Interpretation, IntoResultsViewMsg, SortState, SortedResultSetInfo } from '../interface-types';
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
          if (isResolvableLocation(element.location)) {
            row.push({
              label: label,
              location: element.location
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
  database: DatabaseInfo;
  interpretation: Interpretation | undefined;
  sortedResultsMap: Map<string, SortedResultSetInfo>;
}

interface Results {
  resultSets: readonly ResultSet[];
  sortStates: Map<string, SortState>;
  database: DatabaseInfo;
}

interface ResultsViewProps {
  resultsInfo: ResultsInfo | null;
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
  nextResults: ResultsState | null;
  isExpectingResultsUpdate: boolean;
}

/**
 * A minimal state container for displaying results.
 */
class App extends React.Component<ResultsViewProps, ResultsViewState> {
  private currentResultsInfo: ResultsInfo | null = null;
  private vscodeMessageHandler: ((ev: MessageEvent) => void) | undefined = undefined;

  constructor(props: any) {
    super(props);
    this.state = {
      displayedResults: {
        resultsInfo: null,
        results: null,
        errorMessage: ''
      },
      nextResults: null,
      isExpectingResultsUpdate: false
    };
  }

  static getDerivedStateFromProps(nextProps: Readonly<ResultsViewProps>,
    prevState: ResultsViewState): ResultsViewState | null {

    const resultsInfoSame = (prevState.nextResults && nextProps.resultsInfo === prevState.nextResults.resultsInfo) ||
      (!prevState.nextResults && nextProps.resultsInfo === prevState.displayedResults.resultsInfo);

    // Only update if `resultsInfo` changed.
    if (resultsInfoSame) {
      return null;
    }

    if (nextProps.resultsInfo === null) {
      // No results to display
      return {
        displayedResults: {
          resultsInfo: null,
          results: null,
          errorMessage: 'No results to display'
        },
        isExpectingResultsUpdate: false,
        nextResults: null
      };
    }

    const displayedResults = prevState.displayedResults;
    if (prevState.displayedResults.resultsInfo === null) {
      // First run
      displayedResults.errorMessage = 'Loading results…';
    }

    return {
      displayedResults,
      isExpectingResultsUpdate: prevState.isExpectingResultsUpdate,
      nextResults: {
        resultsInfo: nextProps.resultsInfo,
        results: null,
        errorMessage: ''
      }
    };
  }

  componentDidMount() {
    this.vscodeMessageHandler = evt => this.handleMessage(evt.data as IntoResultsViewMsg);
    window.addEventListener('message', this.vscodeMessageHandler);
    this.loadResults(this.props.resultsInfo);
  }

  componentDidUpdate(prevProps: Readonly<ResultsViewProps>, prevState: Readonly<ResultsViewState>):
    void {

    if (this.state.nextResults !== null) {
      this.loadResults(this.props.resultsInfo);
    }
  }

  componentWillUnmount() {
    if (this.vscodeMessageHandler) {
      window.removeEventListener('message', this.vscodeMessageHandler);
    }
    // Ensure that we don't call `setState` after we're unmounted.
    this.currentResultsInfo = null;
  }

  private async loadResults(resultsInfo: ResultsInfo | null): Promise<void> {
    if (resultsInfo === this.currentResultsInfo) {
      // No change
      return;
    }

    this.currentResultsInfo = resultsInfo;
    if (resultsInfo !== null) {
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
        }
        else {
          errorMessage = 'Unknown error';
        }

        statusText = `Error loading results: ${errorMessage}`;
      }

      // Only set state if this results info is still current.
      if (resultsInfo === this.currentResultsInfo) {
        this.setState({
          displayedResults: {
            resultsInfo: resultsInfo,
            results: results,
            errorMessage: statusText
          },
          nextResults: null,
          isExpectingResultsUpdate: false
        });
      }
    }
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
        sortStates={displayedResults.results.sortStates}
        isLoadingNewResults={this.state.isExpectingResultsUpdate || this.state.nextResults !== null} />;
    }
    else {
      return <span>{displayedResults.errorMessage}</span>;
    }
  }

  handleMessage(msg: IntoResultsViewMsg): void {
    switch (msg.t) {
      case 'setState':
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
}

function renderApp(resultsInfo: ResultsInfo | null): void {
  Rdom.render(
    <App resultsInfo={resultsInfo} />,
    document.getElementById('root')
  );
}

function handleMessage(msg: IntoResultsViewMsg): void {
  switch (msg.t) {
    case 'setState':
      renderApp({
        resultsPath: msg.resultsPath,
        sortedResultsMap: new Map(Object.entries(msg.sortedResultsMap)),
        database: msg.database,
        interpretation: msg.interpretation
      });
      break;
    case 'resultsUpdating':
      break;
    default:
      assertNever(msg);
  }
}

renderApp(null);

window.addEventListener('message', event => {
  handleMessage(event.data as IntoResultsViewMsg);
});
