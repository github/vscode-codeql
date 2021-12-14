import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Rdom from 'react-dom';
import { SetRemoteQueryResultMessage } from '../../pure/interface-types';
import { AnalysisResult, RemoteQueryResult } from '../shared/remote-query-result';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';
import { DownloadLink } from '../download-link';

const numOfReposInContractedMode = 10;

const emptyQueryResult: RemoteQueryResult = {
  queryTitle: '',
  queryFileName: '',
  queryFilePath: '',
  queryText: '',
  totalRepositoryCount: 0,
  affectedRepositoryCount: 0,
  totalResultCount: 0,
  executionTimestamp: '',
  executionDuration: '',
  downloadLink: {
    id: '',
    urlPath: '',
  },
  results: []
};

const download = (link: DownloadLink) => {
  vscode.postMessage({
    t: 'remoteQueryDownloadLinkClicked',
    downloadLink: link
  });
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
        onClick={() => download(props.downloadLink)}>
        {octicons.download}{props.fileSize}
      </a>
    </span>
  </span>
);

const SummaryWithResults = (queryResult: RemoteQueryResult) => (
  <div className="vscode-codeql__query-summary-container">
    <h2 className="vscode-codeql__query-summary-title">Repositories with results ({queryResult.affectedRepositoryCount}):</h2>
    <a className="vscode-codeql__summary-download-link vscode-codeql__download-link"
      onClick={() => download(queryResult.downloadLink)}>
      {octicons.download}Download all
    </a>
  </div>
);

const SummaryNoResults = () => (
  <div className="vscode-codeql__query-summary-container">
    <h2 className="vscode-codeql__query-summary-title">No results found</h2>
  </div>
);

export function RemoteQueries(): JSX.Element {
  const [queryResult, setQueryResult] = useState<RemoteQueryResult>(emptyQueryResult);

  useEffect(() => {
    window.addEventListener('message', (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: SetRemoteQueryResultMessage = evt.data;
        if (msg.t === 'setRemoteQueryResult') {
          setQueryResult(msg.queryResult);
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

  const [repoListExpanded, setRepoListExpanded] = useState(false);
  const numOfReposToShow = repoListExpanded ? queryResult.results.length : numOfReposInContractedMode;

  const openQueryFile = () => {
    vscode.postMessage({
      t: 'openFile',
      filePath: queryResult.queryFilePath
    });
  };

  const openQueryTextVirtualFile = () => {
    vscode.postMessage({
      t: 'openVirtualFile',
      queryText: queryResult.queryText
    });
  };

  try {
    return <div className="vscode-codeql__remote-queries-view">
      <h1 className="vscode-codeql__query-title">{queryResult.queryTitle}</h1>

      <p className="vscode-codeql__paragraph">
        {queryResult.totalResultCount} results in {queryResult.totalRepositoryCount} repositories
        ({queryResult.executionDuration}), {queryResult.executionTimestamp}
      </p>
      <p className="vscode-codeql__paragraph">
        <span className="vscode-codeql__query-file">{octicons.file}
          <a className="vscode-codeql__query-file-link" href="#" onClick={openQueryFile}>
            {queryResult.queryFileName}
          </a>
        </span>
        <span>{octicons.codeSquare}
          <a className="vscode-codeql__query-file-link" href="#" onClick={openQueryTextVirtualFile}>
            query
          </a>
        </span>
      </p>

      {
        queryResult.affectedRepositoryCount === 0
          ? <SummaryNoResults />
          : <SummaryWithResults {...queryResult} />
      }

      <ul className="vscode-codeql__results-list">
        {queryResult.results.slice(0, numOfReposToShow).map((result, i) =>
          <li key={result.nwo} className="vscode-codeql__results-list-item">
            <AnalysisResultItem {...result} />
          </li>
        )}
      </ul>
      {
        queryResult.results.length > numOfReposInContractedMode &&
        <button className="vscode-codeql__expand-button" onClick={() => setRepoListExpanded(!repoListExpanded)}>
          {repoListExpanded ? (<span>View less</span>) : (<span>View all</span>)}
        </button>
      }
    </div>;
  } catch (err) {
    console.error(err);
    return <div>There was an error displaying the view.</div>;
  }
}

Rdom.render(
  <RemoteQueries />,
  document.getElementById('root'),
  // Post a message to the extension when fully loaded.
  () => vscode.postMessage({ t: 'remoteQueryLoaded' })
);
