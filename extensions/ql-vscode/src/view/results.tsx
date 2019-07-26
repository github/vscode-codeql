import * as React from 'react';
import * as Rdom from 'react-dom';
import { ResultSet, TupleValue, LocationStyle, LocationValue } from '../bqrs-types';
import { FromResultsViewMsg, IntoResultsViewMsg, ResultsViewState } from '../interface-types';
import { CSSProperties } from 'react';

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
const vscode = acquireVsCodeApi();

/**
 * Render a location as a link which when clicked displays the original location.
 */
function displayLocation(loc: LocationValue, label: string | undefined, _prim: TupleValue): JSX.Element {
  switch (loc.t) {
    case LocationStyle.FivePart: {
      return <a href="#" onClick={(e) => {
        vscode.postMessage({
          t: 'viewSourceFile',
          loc
        });
        e.preventDefault();
        e.stopPropagation();
      }}>{label}</a>;
    }
    case LocationStyle.String: return <span>{loc.loc}</span>;
    case LocationStyle.No: return <span></span>;
  }
}

/**
 * Render one column of a tuple.
 */
function displayTupleValue(v: TupleValue): JSX.Element {
  switch (v.t) {
    case 'i': return <span>{v.v}</span>;
    case 'u': return <a href={v.v}>{v.v}</a>;
    case 'd': return <span>XXX dates unimplemented</span>;
    case 'f': return <span>{v.v}</span>;
    case 'b': return <span>{v.v}</span>;
    case 's': return <span>{v.v}</span>;
    case 'e': return displayLocation(v.loc, v.label, v.primitive);
  }
}

/**
 * Render a table of results.
 */
function resultTable(data: ResultSet): JSX.Element {
  const headerRowStyle: CSSProperties = {
    borderBottom: "1px solid black",
    padding: "0.5em",
  };
  return <table style={{ borderCollapse: "collapse" }}>
    <tbody>
      <tr>
        {data.columns.map(col => <td style={headerRowStyle}><b>{col.name}</b></td>)}
      </tr>
      {
        data.results.map((tuple, i) => {
          const resultsRowStyle: CSSProperties = {
            backgroundColor: i % 2 ? "#ddd" : undefined
          };
          return <tr style={resultsRowStyle}>
            {tuple.map(item => <td style={{ padding: "0.5em" }}>{displayTupleValue(item)}</td>)}
          </tr>
        })
      }
    </tbody>
  </table>
}

/**
 * Render all tables of results. XXX: Haven't tested with more than
 * one, probably looks bad.
 */
function resultTables(data: ResultSet[] | undefined): JSX.Element {
  if (data == undefined) return <span></span>;
  return <span>{data.map(resultTable)}</span>
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
        this.setState(msg.s);
    }
  }

  constructor(props: any) {
    super(props);
    this.state = { results: undefined };
  }

  render() {
    if (this.state.results == undefined)
      return <span>Results Undefined</span>;
    return (
      <div>
        {resultTables(this.state.results)}
      </div>
    );
  }
}

Rdom.render(
  <App />,
  document.getElementById('root')
);
