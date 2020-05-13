import * as React from 'react';
import { DatabaseInfo, Interpretation, RawResultsSortState, QueryMetadata, ResultsPaths, InterpretedResultsSortState } from '../interface-types';
import { PathTable } from './alert-table';
import { RawTable } from './raw-results-table';
import { ResultTableProps, tableSelectionHeaderClassName, toggleDiagnosticsClassName, alertExtrasClassName } from './result-table-utils';
import { ResultSet, vscode } from './results';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
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
}

const ALERTS_TABLE_NAME = 'alerts';
const SELECT_TABLE_NAME = '#select';
const UPDATING_RESULTS_TEXT_CLASS_NAME = "vscode-codeql__result-tables-updating-text";

function getResultCount(resultSet: ResultSet): number {
  switch (resultSet.t) {
    case 'RawResultSet':
      return resultSet.schema.tupleCount;
    case 'SarifResultSet':
      if (resultSet.sarif.runs.length === 0) return 0;
      if (resultSet.sarif.runs[0].results === undefined) return 0;
      return resultSet.sarif.runs[0].results.length + resultSet.numTruncatedResults;
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

  private getResultSets(): ResultSet[] {
    const resultSets: ResultSet[] =
      this.props.rawResultSets.map(rs => ({ t: 'RawResultSet', ...rs }));

    if (this.props.interpretation != undefined) {
      resultSets.push({
        t: 'SarifResultSet',
        // FIXME: The values of version, columns, tupleCount are
        // unused stubs because a SarifResultSet schema isn't used the
        // same way as a RawResultSet. Probably should pull `name` field
        // out.
        schema: { name: ALERTS_TABLE_NAME, version: 0, columns: [], tupleCount: 1 },
        name: ALERTS_TABLE_NAME,
        ...this.props.interpretation,
      });
    }
    return resultSets;
  }

  constructor(props: ResultTablesProps) {
    super(props);

    this.state = {
      // Get the result set that should be displayed by default
      selectedTable: ResultTables.getDefaultResultSet(this.getResultSets())
    };
  }

  private static getDefaultResultSet(resultSets: readonly ResultSet[]): string {
    const resultSetNames = resultSets.map(resultSet => resultSet.schema.name);
    // Choose first available result set from the array
    return [ALERTS_TABLE_NAME, SELECT_TABLE_NAME, resultSets[0].schema.name].filter(resultSetName => resultSetNames.includes(resultSetName))[0];
  }

  private onTableSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({ selectedTable: event.target.value });
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

  render(): React.ReactNode {
    const { selectedTable } = this.state;
    const resultSets = this.getResultSets();

    const resultSet = resultSets.find(resultSet => resultSet.schema.name == selectedTable);
    const nonemptyRawResults = resultSets.some(resultSet => resultSet.t == 'RawResultSet' && resultSet.rows.length > 0);
    const numberOfResults = resultSet && renderResultCountString(resultSet);

    return <div>
      <div className={tableSelectionHeaderClassName}>
        <select value={selectedTable} onChange={this.onTableSelectionChange}>
          {
            resultSets.map(resultSet =>
              <option key={resultSet.schema.name} value={resultSet.schema.name}>
                {resultSet.schema.name}
              </option>
            )
          }
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
          showRawResults={() => { this.setState({ selectedTable: SELECT_TABLE_NAME }); }} />
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
