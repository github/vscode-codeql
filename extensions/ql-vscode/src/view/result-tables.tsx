import * as React from 'react';
import { ResultSet } from '../bqrs-types';
import { ResultTable } from './result-table';
import './results.css';
import { DatabaseInfo } from '../interface-types';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  resultSets: ResultSet[];
  database: DatabaseInfo;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  selectedTable: string;
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
      selectedTable: props.resultSets.find(table => table.name === SELECT_TABLE_NAME) ?
        SELECT_TABLE_NAME : props.resultSets[0].name
    };
  }

  private onChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({ selectedTable: event.target.value });
  }

  render(): React.ReactNode {
    const { selectedTable } = this.state;

    return <div>
      <select value={selectedTable} onChange={this.onChange}>
        {this.props.resultSets.map(resultSet => <option value={resultSet.name}>{resultSet.name}</option>)}
      </select>
      {this.props.resultSets.map(resultSet => {
        return <ResultTable resultSet={resultSet} srcRootUri={this.props.database.srcRootUri} selected={resultSet.name === selectedTable}/>;
      })}
    </div>;
  }
}
