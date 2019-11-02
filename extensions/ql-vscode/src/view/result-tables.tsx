import * as React from 'react';
import { DatabaseInfo, Interpretation } from '../interface-types';
import { ResultTableProps } from './result-table-utils';
import { ResultSet } from './results';
import { RawTable } from './raw-results-table';
import { PathTable } from './alert-table';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  rawResultSets: readonly ResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
  resultsPath: string | undefined;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: string; // name of selected result set
}

const ALERTS_TABLE_NAME = 'alerts';
const SELECT_TABLE_NAME = '#select';

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
    const resultSetNames = resultSets.map(resultSet => resultSet.schema.name)
    // Choose first available result set from the array
    return [ALERTS_TABLE_NAME, SELECT_TABLE_NAME, resultSets[0].schema.name].filter(resultSetName => resultSetNames.includes(resultSetName))[0];
  }

  private onChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({ selectedTable: event.target.value });
  }

  render(): React.ReactNode {
    const selectedTable = this.state.selectedTable;
    const resultSets = this.getResultSets();

    return <div>
      <select value={selectedTable} onChange={this.onChange}>
        {
          resultSets.map(resultSet =>
            <option key={resultSet.schema.name} value={resultSet.schema.name}>
              {resultSet.schema.name}
            </option>
          )
        }
      </select>
      {
        resultSets.map(resultSet =>
          <ResultTable key={resultSet.schema.name} resultSet={resultSet}
            databaseUri={this.props.database.databaseUri} selected={resultSet.schema.name === selectedTable}
            resultsPath={this.props.resultsPath} />
        )
      }
    </div >;
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
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} resultsPath={this.props.resultsPath} />;
      case 'SarifResultSet': return <PathTable
        selected={this.props.selected} resultSet={resultSet} databaseUri={this.props.databaseUri} resultsPath={this.props.resultsPath} />;
    }
  }
}
