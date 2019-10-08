import * as React from 'react';
import { DatabaseInfo, Interpretation } from '../interface-types';
import { ResultTable } from './result-table';
import { InterfaceResultSet } from './results';
import './results.css';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  resultSets: readonly InterfaceResultSet[];
  interpretation: Interpretation | undefined;
  database: DatabaseInfo;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: InterfaceResultSet;
}

const SELECT_TABLE_NAME = '#select';

/**
 * Displays multiple `ResultTable` tables, where the table to be displayed is selected by a
 * dropdown.
 */
export class ResultTables
  extends React.Component<ResultTablesProps, ResultTablesState> {

  constructor(props: ResultTablesProps) {
    super(props);

    // Display the `#select` table by default if one exists. Otherwise, display the first table in
    // the result set.
    this.state = {
      selectedTable: ResultTables.getDefaultResultSet(props.resultSets)
    };
  }

  private static getDefaultResultSet(resultSets: readonly InterfaceResultSet[]): InterfaceResultSet {
    return resultSets.find(resultSet =>
      resultSet.schema.name === SELECT_TABLE_NAME) || resultSets[0];
  }

  private onChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({
      selectedTable:
        this.props.resultSets.find(resultSet => resultSet.schema.name === event.target.value)!
    });
  }

  render(): React.ReactNode {
    const { selectedTable } = this.state;

    const interfaceResultSets: InterfaceResultSet[] =
      this.props.resultSets.map(rs => ({ t: 'RawResultSet', ...rs }));

    if (this.props.interpretation != undefined) {
      interfaceResultSets.push({
        t: 'SarifResultSet',
        schema: { name: 'sarif', version: 0, columns: [], tupleCount: 1 },
        name: 'alerts',
        ...this.props.interpretation,
      });
    }

    return <div>
      <select value={selectedTable.schema.name} onChange={this.onChange}>
        {
          this.props.resultSets.map(resultSet =>
            <option key={resultSet.schema.name} value={resultSet.schema.name}>
              {resultSet.schema.name}
            </option>
          )
        }
      </select>
      {
        this.props.resultSets.map(resultSet =>
          <ResultTable key={resultSet.schema.name} resultSet={resultSet}
            databaseUri={this.props.database.databaseUri} selected={resultSet === selectedTable} />
        )
      }
    </div >;

  }
}
