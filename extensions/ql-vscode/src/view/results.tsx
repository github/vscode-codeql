import * as React from 'react';
import * as Rdom from 'react-dom';
import * as bqrs from 'semmle-bqrs';
import { ElementBase, isResolvableLocation, LocationValue, PrimitiveColumnValue, PrimitiveTypeKind, ResultSetSchema } from 'semmle-bqrs';
import { DatabaseInfo, FromResultsViewMsg, Interpretation, IntoResultsViewMsg } from '../interface-types';
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

export type RawTableResultSet = { t: 'RawResultSet' } & ResultSet;
export type PathTableResultSet = { t: 'SarifResultSet', readonly schema: ResultSetSchema, name: string } & Interpretation;

export type InterfaceResultSet =
  | RawTableResultSet
  | PathTableResultSet;

export interface ResultSet {
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

async function parseResultSets(response: Response): Promise<readonly InterfaceResultSet[]> {
  const chunks = getChunkIterator(response);

  const resultSets: InterfaceResultSet[] = [];

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
}

interface Results {
  resultSets: readonly InterfaceResultSet[];
  database: DatabaseInfo;
}

interface ResultsViewProps {
  resultsInfo: ResultsInfo | null;
}

interface ResultsViewState {
  // We use `null` instead of `undefined` here because in React, `undefined` is
  // used to mean "did not change" when updating the state of a component.
  resultsInfo: ResultsInfo | null;
  results: Results | null;
  errorMessage: string;
}

/**
 * A minimal state container for displaying results.
 */
class App extends React.Component<ResultsViewProps, ResultsViewState> {
  private currentResultsInfo: ResultsInfo | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      resultsInfo: null,
      results: null,
      errorMessage: ''
    };
  }

  static getDerivedStateFromProps(nextProps: Readonly<ResultsViewProps>,
    prevState: ResultsViewState): Partial<ResultsViewState> | null {

    // Only update if `resultsInfo` changed.
    if (nextProps.resultsInfo !== prevState.resultsInfo) {
      return {
        resultsInfo: nextProps.resultsInfo,
        results: null,
        errorMessage: (nextProps.resultsInfo !== null) ?
          'Loading results...' : 'No results to display'
      };
    }

    return null;
  }

  componentDidMount() {
    this.loadResults(this.props.resultsInfo);
  }

  componentDidUpdate(prevProps: Readonly<ResultsViewProps>, prevState: Readonly<ResultsViewState>):
    void {

    if (this.state.results === null) {
      this.loadResults(this.props.resultsInfo);
    }
  }

  componentWillUnmount() {
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
        const response = await fetch(resultsInfo.resultsPath);
        results = {
          resultSets: await parseResultSets(response),
          database: resultsInfo.database
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
          resultsInfo: resultsInfo,
          results: results,
          errorMessage: statusText
        });
      }
    }
  }

  render() {
    if (this.state.results !== null) {
      return <ResultTables resultSets={this.state.results.resultSets}
        interpretation={this.state.resultsInfo ? this.state.resultsInfo.interpretation : undefined}
        database={this.state.results.database} />;
    }
    else {
      return <span>{this.state.errorMessage}</span>;
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
        database: msg.database,
        interpretation: msg.interpretation,
      });
      break;
  }
}

renderApp(null);

window.addEventListener('message', event => {
  handleMessage(event.data as IntoResultsViewMsg);
});
