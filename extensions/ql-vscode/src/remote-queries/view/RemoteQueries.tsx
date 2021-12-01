import * as React from 'react';
import * as Rdom from 'react-dom';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';

interface AnalysisResult {
  nwo: string,
  resultCount: number,
  downloadLink: string,
  fileSize: string,
}

interface Props {
  queryTitle: string;
  queryFile: string;
  totalRepositoryCount: number;
  totalResultCount: number;
  executionTimestamp: string;
  executionDuration: string;
  downloadLink: string;
  results: AnalysisResult[]
}

const AnalysisResult = (props: AnalysisResult) => (
  <span>
    <span className="vscode-codeql__analysis-item">{octicons.repo}</span>
    <span className="vscode-codeql__analysis-item">{props.nwo}</span>
    <span className="vscode-codeql__analysis-item vscode-codeql__badge-container">
      <span className="vscode-codeql__badge">{props.resultCount}</span>
    </span>
    <span className="vscode-codeql__analysis-item">
      <a
        className="vscode-codeql__download-link"
        href={props.downloadLink}>
        {octicons.download}{props.fileSize}
      </a>
    </span>
  </span>
);

export function RemoteQueries(props: Props): JSX.Element {
  return <div className="vscode-codeql__remote-queries-view">
    <h1 className="vscode-codeql__query-title">{props.queryTitle}</h1>

    <p className="vscode-codeql__paragraph">
      {props.totalResultCount} results in {props.totalRepositoryCount} repositories
      ({props.executionDuration}), {props.executionTimestamp}
    </p>
    <p className="vscode-codeql__paragraph">
      <span className="vscode-codeql__query-file">{octicons.file} <span>{props.queryFile}</span></span>
      <span>{octicons.codeSquare} <span>query</span></span>
    </p>

    <div className="vscode-codeql__query-summary-container">
      <h2 className="vscode-codeql__query-summary-title">Repositories with results ({props.totalRepositoryCount}):</h2>
      <a className="vscode-codeql__summary-download-link vscode-codeql__download-link" href={props.downloadLink}>
        {octicons.download}Download all
      </a>
    </div>

    <ul className="vscode-codeql__results-list">
      {props.results.map(result =>
        <li key={result.nwo} className="vscode-codeql__results-list-item">
          <AnalysisResult {...result} />
        </li>
      )}
    </ul>
  </div>;
}

const formatDate = (d: Date): string => {
  const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
  return `${datePart} at ${timePart}`;
};

const data: Props = {
  queryTitle: 'Empty block',
  queryFile: 'example.ql',
  totalRepositoryCount: 13,
  totalResultCount: 72,
  executionTimestamp: formatDate(new Date()),
  executionDuration: '0.6 seconds',
  downloadLink: 'www.example.com',
  results: [
    {
      nwo: 'github/foo',
      resultCount: 35,
      downloadLink: 'www.example.com',
      fileSize: '12.3mb'
    },
    {
      nwo: 'github/bar',
      resultCount: 9,
      downloadLink: 'www.example.com',
      fileSize: '10.1mb'
    },
    {
      nwo: 'github/baz',
      resultCount: 80,
      downloadLink: 'www.example.com',
      fileSize: '11.2mb'
    }
  ]
};

Rdom.render(
  <RemoteQueries {...data} />,
  document.getElementById('root'),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: 'remoteQueryLoaded' })
);
