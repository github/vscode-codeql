import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Rdom from 'react-dom';
import { SetRemoteQueryResultMessage } from '../../pure/interface-types';
import { AnalysisResult, RemoteQueryResult } from './remote-query-result';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';

const emptyQueryResult: RemoteQueryResult = {
  queryTitle: '',
  queryFile: '',
  totalRepositoryCount: 0,
  affectedRepositoryCount: 0,
  totalResultCount: 0,
  executionTimestamp: '',
  executionDuration: '',
  downloadLink: '',
  results: []
};

const AnalysisResultItem = (props: AnalysisResult) => (
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

export function RemoteQueries(_: Record<string, never>): JSX.Element {
  const [queryResult, setQueryResult] = useState<RemoteQueryResult>(emptyQueryResult);

  useEffect(() => {
    window.addEventListener('message', (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: SetRemoteQueryResultMessage = evt.data;
        if (msg.t === 'setRemoteQueryResult') {
          setQueryResult(msg.d);
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, '');
        console.error(`Invalid event origin ${origin}`);
      }
    });
  });

  if (!queryResult) {
    return <div>Waiting for results to load.</div>;
  }

  try {
    return <div className="vscode-codeql__remote-queries-view">
      <h1 className="vscode-codeql__query-title">{queryResult.queryTitle}</h1>

      <p className="vscode-codeql__paragraph">
        {queryResult.totalResultCount} results in {queryResult.totalRepositoryCount} repositories
        ({queryResult.executionDuration}), {queryResult.executionTimestamp}
      </p>
      <p className="vscode-codeql__paragraph">
        <span className="vscode-codeql__query-file">{octicons.file} <span>{queryResult.queryFile}</span></span>
        <span>{octicons.codeSquare} <span>query</span></span>
      </p>

      <div className="vscode-codeql__query-summary-container">
        <h2 className="vscode-codeql__query-summary-title">Repositories with results ({queryResult.affectedRepositoryCount}):</h2>
        <a className="vscode-codeql__summary-download-link vscode-codeql__download-link" href={queryResult.downloadLink}>
          {octicons.download}Download all
        </a>
      </div>

      <ul className="vscode-codeql__results-list">
        {queryResult.results.map(result =>
          <li key={result.nwo} className="vscode-codeql__results-list-item">
            <AnalysisResultItem {...result} />
          </li>
        )}
      </ul>
    </div>;
  } catch (err) {
    console.error(err);
    return <div>Error!</div>;
  }
}

Rdom.render(
  <RemoteQueries />,
  document.getElementById('root'),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: 'remoteQueryLoaded' })
);
