import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Rdom from 'react-dom';
import { SetRemoteQueryResultMessage } from '../../pure/interface-types';
import { AnalysisSummary, RemoteQueryResult } from '../shared/remote-query-result';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';
import { DownloadLink } from '../download-link';

import SectionTitle from './SectionTitle';
import VerticalSpace from './VerticalSpace';
import Badge from './Badge';
import ViewTitle from './ViewTitle';
import DownloadButton from './DownloadButton';

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
  analysisSummaries: []
};

const download = (link: DownloadLink) => {
  vscode.postMessage({
    t: 'remoteQueryDownloadLinkClicked',
    downloadLink: link
  });
};

const openQueryFile = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: 'openFile',
    filePath: queryResult.queryFilePath
  });
};

const openQueryTextVirtualFile = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: 'openVirtualFile',
    queryText: queryResult.queryText
  });
};

const QueryInfo = (queryResult: RemoteQueryResult) => (
  <>
    <VerticalSpace />
    {queryResult.totalResultCount} results in {queryResult.totalRepositoryCount} repositories
    ({queryResult.executionDuration}), {queryResult.executionTimestamp}
    <VerticalSpace />
    <span className="vscode-codeql__query-file">{octicons.file}
      <a className="vscode-codeql__query-file-link" href="#" onClick={() => openQueryFile(queryResult)}>
        {queryResult.queryFileName}
      </a>
    </span>
    <span>{octicons.codeSquare}
      <a className="vscode-codeql__query-file-link" href="#" onClick={() => openQueryTextVirtualFile(queryResult)}>
        query
      </a>
    </span>
  </>
);

const SummaryTitleWithResults = (queryResult: RemoteQueryResult) => (
  <div className="vscode-codeql__query-summary-container">
    <SectionTitle text={`Repositories with results (${queryResult.affectedRepositoryCount}):`} />
    <DownloadButton text="Download all" onClick={() => download(queryResult.downloadLink)} />
  </div>
);

const SummaryTitleNoResults = () => (
  <div className="vscode-codeql__query-summary-container">
    <SectionTitle text="No results found" />
  </div>
);

const SummaryItem = (props: AnalysisSummary) => (
  <span>
    <span className="vscode-codeql__analysis-item">{octicons.repo}</span>
    <span className="vscode-codeql__analysis-item">{props.nwo}</span>
    <span className="vscode-codeql__analysis-item"><Badge text={props.resultCount.toString()} /></span>
    <span className="vscode-codeql__analysis-item">
      <DownloadButton text={props.fileSize} onClick={() => download(props.downloadLink)} />
    </span>
  </span>
);

const Summary = (queryResult: RemoteQueryResult) => {
  const [repoListExpanded, setRepoListExpanded] = useState(false);
  const numOfReposToShow = repoListExpanded ? queryResult.analysisSummaries.length : numOfReposInContractedMode;

  return (
    <>
      {
        queryResult.affectedRepositoryCount === 0
          ? <SummaryTitleNoResults />
          : <SummaryTitleWithResults {...queryResult} />
      }

      <ul className="vscode-codeql__analysis-summaries-list">
        {queryResult.analysisSummaries.slice(0, numOfReposToShow).map((summary, i) =>
          <li key={summary.nwo} className="vscode-codeql__analysis-summaries-list-item">
            <SummaryItem {...summary} />
          </li>
        )}
      </ul>
      {
        queryResult.analysisSummaries.length > numOfReposInContractedMode &&
        <button className="vscode-codeql__expand-button" onClick={() => setRepoListExpanded(!repoListExpanded)}>
          {repoListExpanded ? (<span>View less</span>) : (<span>View all</span>)}
        </button>
      }
    </>
  );
};

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

  try {
    return <div>
      <ViewTitle title={queryResult.queryTitle} />
      <QueryInfo {...queryResult} />
      <Summary {...queryResult} />
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
