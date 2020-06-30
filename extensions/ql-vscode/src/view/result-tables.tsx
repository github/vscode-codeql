import * as React from 'react';
import {
  DatabaseInfo,
  Interpretation,
  RawResultsSortState,
  QueryMetadata,
  ResultsPaths,
  InterpretedResultsSortState,
  RAW_RESULTS_PAGE_SIZE,
  ResultSet,
  ALERTS_TABLE_NAME,
  SELECT_TABLE_NAME,
  getDefaultResultSetName,
} from '../interface-types';
import { PathTable } from './alert-table';
import { RawTable } from './raw-results-table';
import { ResultTableProps, tableSelectionHeaderClassName, toggleDiagnosticsClassName, alertExtrasClassName } from './result-table-utils';
import { ParsedResultSets, ExtensionParsedResultSets } from '../adapt';
import { vscode } from './vscode-api';


/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  parsedResultSets: ParsedResultSets;
  rawResultSets: readonly ResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
  metadata?: QueryMetadata;
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  sortStates: Map<string, RawResultsSortState>;
  interpretedSortState?: InterpretedResultsSortState;
  isLoadingNewResults: boolean;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: string; // name of selected result set
  selectedPage: string; // stringified selected page
}

const UPDATING_RESULTS_TEXT_CLASS_NAME = 'vscode-codeql__result-tables-updating-text';

function getResultCount(resultSet: ResultSet): number {
  switch (resultSet.t) {
    case 'RawResultSet':
      return resultSet.schema.tupleCount;
    case 'SarifResultSet':
      return resultSet.numTotalResults;
  }
}

function renderResultCountString(resultSet: ResultSet): JSX.Element {
  const resultCount = getResultCount(resultSet);
  return <span className="number-of-results">
    {resultCount} {resultCount === 1 ? 'result' : 'results'}
  </span>;
}

/**
 * Displays multiple `ResultTable` tables, where the table to be displayed is selected by a
 * dropdown.
 */
export class ResultTables
  extends React.Component<ResultTablesProps, ResultTablesState> {

  private static _getResultSetsOfProps(props: ResultTablesProps): ResultSet[] {
    const resultSets: ResultSet[] =
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore 2783
      props.rawResultSets.map((rs) => ({ t: 'RawResultSet', ...rs }));

    if (props.interpretation != undefined) {
      resultSets.push({
        t: 'SarifResultSet',
        // FIXME: The values of version, columns, tupleCount are
        // unused stubs because a SarifResultSet schema isn't used the
        // same way as a RawResultSet. Probably should pull `name` field
        // out.
        schema: { name: ALERTS_TABLE_NAME, version: 0, columns: [], tupleCount: 1 },
        name: ALERTS_TABLE_NAME,
        ...props.interpretation,
      });
    }
    return resultSets;
  }

  private getResultSets(): ResultSet[] {
    return ResultTables._getResultSetsOfProps(this.props);
  }

  private getResultSetNames(resultSets: ResultSet[]): string[] {
    if (this.props.parsedResultSets.t === 'ExtensionParsed') {
      return this.props.parsedResultSets.resultSetNames.concat([ALERTS_TABLE_NAME]);
    }
    else {
      return resultSets.map(resultSet => resultSet.schema.name);
    }
  }

  /**
   * Holds if we have a result set obtained from the extension that came
   * from the ExtensionParsed branch of ParsedResultSets. This is evidence
   * that the user has the experimental flag turned on that allows extension-side
   * bqrs parsing.
   */
  paginationAllowed(): boolean {
    return this.props.parsedResultSets.t === 'ExtensionParsed';
  }

  /**
   * Holds if we actually should show pagination interface right now. This is
   * true as long as the result sets we're given are marked to permit it.
   */
  paginationEnabled(): boolean {
    return this.paginationAllowed()
  }

  constructor(props: ResultTablesProps) {
    super(props);
    this.state = ResultTables.getDerivedStateFromProps(props);
  }

  // Static lifecycle method which is called by react when props change.
  static getDerivedStateFromProps(props: Readonly<ResultTablesProps>, _prevState?: ResultTablesState): ResultTablesState {
    const selectedTable = props.parsedResultSets.selectedTable || getDefaultResultSet(ResultTables._getResultSetsOfProps(props));
    let selectedPage: string;

    switch (props.parsedResultSets.t) {
      case 'ExtensionParsed':
        selectedPage = (props.parsedResultSets.pageNumber + 1) + '';
        break;
      case 'WebviewParsed':
        selectedPage = '';
        break;
    }
    return { selectedTable, selectedPage };
  }

  private onTableSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const selectedTable = event.target.value;
    const fetchPageFromExtension = this.paginationAllowed() && selectedTable !== ALERTS_TABLE_NAME;

    if (fetchPageFromExtension) {
      vscode.postMessage({
        t: 'changePage',
        pageNumber: 0,
        selectedTable
      });
    }
    else
      this.setState({ selectedTable });
  }

  private alertTableExtras(): JSX.Element | undefined {
    const { database, resultsPath, metadata, origResultsPaths } = this.props;

    const displayProblemsAsAlertsToggle =
      <div className={toggleDiagnosticsClassName}>
        <input type="checkbox" id="toggle-diagnostics" name="toggle-diagnostics" onChange={(e) => {
          if (resultsPath !== undefined) {
            vscode.postMessage({
              t: 'toggleDiagnostics',
              origResultsPaths: origResultsPaths,
              databaseUri: database.databaseUri,
              visible: e.target.checked,
              metadata: metadata
            });
          }
        }} />
        <label htmlFor="toggle-diagnostics">Show results in Problems view</label>
      </div>;

    return <div className={alertExtrasClassName}>
      {displayProblemsAsAlertsToggle}
    </div>;
  }

  getOffset(): number {
    const { parsedResultSets } = this.props;
    switch (parsedResultSets.t) {
      case 'ExtensionParsed':
        return parsedResultSets.pageNumber * RAW_RESULTS_PAGE_SIZE;
      case 'WebviewParsed':
        return 0;
    }
  }

  renderPageButtons(resultSets: ExtensionParsedResultSets): JSX.Element {
    const selectedTable = this.state.selectedTable;
    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      this.setState({ selectedPage: e.target.value });
    };
    const choosePage = (input: string) => {
      const pageNumber = parseInt(input);
      if (pageNumber !== undefined && !isNaN(pageNumber)) {
        const actualPageNumber = Math.max(0, Math.min(pageNumber - 1, resultSets.numPages - 1));
        vscode.postMessage({
          t: 'changePage',
          pageNumber: actualPageNumber,
          selectedTable,
        });
      }
    };

    const prevPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      vscode.postMessage({
        t: 'changePage',
        pageNumber: Math.max(resultSets.pageNumber - 1, 0),
        selectedTable,
      });
    };
    const nextPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      vscode.postMessage({
        t: 'changePage',
        pageNumber: Math.min(resultSets.pageNumber + 1, resultSets.numPages - 1),
        selectedTable,
      });
    };
    return <span>
      <button onClick={prevPage} >&lt;</button>
      <input size={3} value={this.state.selectedPage} onChange={onChange}
        onBlur={e => choosePage(e.target.value)}
        onKeyDown={e => { if (e.keyCode === 13) choosePage((e.target as HTMLInputElement).value); }}
      />
      / {resultSets.numPages}
      <button value=">" onClick={nextPage} >&gt;</button>
    </span>;
  }

  renderButtons(): JSX.Element {
    if (this.props.parsedResultSets.t === 'ExtensionParsed' && this.paginationEnabled())
      return this.renderPageButtons(this.props.parsedResultSets);
    else
      return <span />;
  }

  render(): React.ReactNode {
    const { selectedTable } = this.state;
    const resultSets = this.getResultSets();
    const resultSetNames = this.getResultSetNames(resultSets);

    const resultSet = resultSets.find(resultSet => resultSet.schema.name == selectedTable);
    const nonemptyRawResults = resultSets.some(resultSet => resultSet.t == 'RawResultSet' && resultSet.rows.length > 0);
    const numberOfResults = resultSet && renderResultCountString(resultSet);

    const resultSetOptions =
      resultSetNames.map(name => <option key={name} value={name}>{name}</option>);

    return <div>
      {this.renderButtons()}
      <div className={tableSelectionHeaderClassName}>
        <select value={selectedTable} onChange={this.onTableSelectionChange}>
          {resultSetOptions}
        </select>
        {numberOfResults}
        {selectedTable === ALERTS_TABLE_NAME ? this.alertTableExtras() : undefined}
        {
          this.props.isLoadingNewResults ?
            <span className={UPDATING_RESULTS_TEXT_CLASS_NAME}>Updating results…</span>
            : null
        }
      </div>
      {
        resultSet &&
        <ResultTable key={resultSet.schema.name} resultSet={resultSet}
          databaseUri={this.props.database.databaseUri}
          resultsPath={this.props.resultsPath}
          sortState={this.props.sortStates.get(resultSet.schema.name)}
          nonemptyRawResults={nonemptyRawResults}
          showRawResults={() => { this.setState({ selectedTable: SELECT_TABLE_NAME }); }}
          offset={this.getOffset()} />
      }
    </div>;
  }
}

class ResultTable extends React.Component<ResultTableProps, {}> {

  constructor(props: ResultTableProps) {
    super(props);
  }

  render(): React.ReactNode {
    const { resultSet } = this.props;
    switch (resultSet.t) {
      case 'RawResultSet': return <RawTable
        {...this.props} resultSet={resultSet} />;
      case 'SarifResultSet': return <PathTable
        {...this.props} resultSet={resultSet} />;
    }
  }
}

function getDefaultResultSet(resultSets: readonly ResultSet[]): string {
  return getDefaultResultSetName(
    resultSets.map((resultSet) => resultSet.schema.name)
  );
}
