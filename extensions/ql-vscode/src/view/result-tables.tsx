import * as React from 'react';
import { DatabaseInfo, Interpretation } from '../interface-types';
import { ResultTable } from './result-table';
import { ResultSet } from './results';
import './results.css';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  rawResultSets: readonly ResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: string; // name of selected result set
}

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
        schema: { name: 'alerts', version: 0, columns: [], tupleCount: 1 },
        name: 'alerts',
        ...this.props.interpretation,
      });
    }
    return resultSets;
  }

  constructor(props: ResultTablesProps) {
    super(props);

    // Display the `#select` table by default if one exists. Otherwise, display the first table in
    // the result set.
    this.state = {
      selectedTable: ResultTables.getDefaultResultSet(this.getResultSets())
    };
  }

  private static getDefaultResultSet(resultSets: readonly ResultSet[]): string {
    return resultSets.some(resultSet =>
      resultSet.schema.name === SELECT_TABLE_NAME) ? SELECT_TABLE_NAME : resultSets[0].schema.name;
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
            databaseUri={this.props.database.databaseUri} selected={resultSet.schema.name === selectedTable} />
        )
      }
    </div >;
  }
}
