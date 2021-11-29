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
    <span className="analysis-item">{octicons.repo}</span>
    <span className="analysis-item">{props.nwo}</span>
    <span className="analysis-item badge-container">
      <span className="badge">{props.resultCount}</span>
    </span>
    <span className="analysis-item">
      <a
        className="download-link"
        href={props.downloadLink}>
        {octicons.download}{props.fileSize}
      </a>
    </span>
  </span>
);

export function RemoteQueries(props: Props): JSX.Element {
  return <div>
    <h1 className="query-title">{props.queryTitle}</h1>

    <p>
      {props.totalResultCount} results in {props.totalRepositoryCount} repositories
      ({props.executionDuration}), {props.executionTimestamp}
    </p>
    <p>
      <span className="query-file">{octicons.file} <span>{props.queryFile}</span></span>
      <span>{octicons.codeSquare} <span>query</span></span>
    </p>

    <div className="summary-container">
      <h2 className="summary-title">Summary: {props.totalRepositoryCount} repositories affected</h2>
      <a className="summary-download-link download-link" href={props.downloadLink}>
        {octicons.download}Download all
      </a>
    </div>

    <ul className="results-list">
      {props.results.map(result =>
        <li key={result.nwo} className="results-list-item">
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
