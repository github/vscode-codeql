import * as React from 'react';
import * as Rdom from 'react-dom';
import { IntoResultsViewMsg, FromResultsViewMsg, DatabaseInfo } from '../interface-types';
import { ResultTables } from './result-tables';
import { ResultSet } from '../bqrs-types';

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

interface ResultsViewState {
  results?: ResultSet[];
  database?: DatabaseInfo;
}

/**
 * A minimal state container for displaying results.
 */
class App extends React.Component<{}, ResultsViewState> {

  componentDidMount() {
    window.addEventListener('message', event => {
      this.handleMessage(event.data as IntoResultsViewMsg);
    })
  }

  handleMessage(msg: IntoResultsViewMsg) {
    switch (msg.t) {
      case 'setState':
        this.setState({
          results: msg.results,
          database: msg.database
        });
    }
  }

  constructor(props: any) {
    super(props);
    this.state = { results: undefined };
  }

  render() {
    if (this.state.results == undefined)
      return <span>Results Undefined</span>;
    return <ResultTables resultSets={this.state.results} database={this.state.database}/>;
  }
}

Rdom.render(
  <App />,
  document.getElementById('root')
);
