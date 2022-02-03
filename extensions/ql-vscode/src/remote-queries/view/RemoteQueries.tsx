import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Rdom from 'react-dom';
import { ThemeProvider } from '@primer/react';
import { ToRemoteQueriesMessage } from '../../pure/interface-types';
import { AnalysisSummary, RemoteQueryResult } from '../shared/remote-query-result';
import * as octicons from '../../view/octicons';

import { vscode } from '../../view/vscode-api';

import SectionTitle from './SectionTitle';
import VerticalSpace from './VerticalSpace';
import HorizontalSpace from './HorizontalSpace';
import Badge from './Badge';
import ViewTitle from './ViewTitle';
import DownloadButton from './DownloadButton';
import { AnalysisResults } from '../shared/analysis-result';
import DownloadSpinner from './DownloadSpinner';

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

const downloadAnalysisResults = (analysisSummary: AnalysisSummary) => {
  vscode.postMessage({
    t: 'remoteQueryDownloadAnalysisResults',
    analysisSummary
  });
};

const downloadAllAnalysesResults = (query: RemoteQueryResult) => {
  vscode.postMessage({
    t: 'remoteQueryDownloadAllAnalysesResults',
    analysisSummaries: query.analysisSummaries
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

const sumAnalysesResults = (analysesResults: AnalysisResults[]) =>
  analysesResults.reduce((acc, curr) => acc + curr.results.length, 0);

const QueryInfo = (queryResult: RemoteQueryResult) => (
  <>
    <VerticalSpace size={1} />
    {queryResult.totalResultCount} results in {queryResult.totalRepositoryCount} repositories
    ({queryResult.executionDuration}), {queryResult.executionTimestamp}
    <VerticalSpace size={1} />
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

const SummaryTitleWithResults = ({
  queryResult,
  analysesResults
}: {
  queryResult: RemoteQueryResult,
  analysesResults: AnalysisResults[]
}) => {
  const showDownloadButton = queryResult.totalResultCount !== sumAnalysesResults(analysesResults);

  return (
    <div className="vscode-codeql__query-summary-container">
      <SectionTitle>Repositories with results ({queryResult.affectedRepositoryCount}):</SectionTitle>
      {
        showDownloadButton && <DownloadButton
          text="Download all"
          onClick={() => downloadAllAnalysesResults(queryResult)} />
      }
    </div>
  );
};

const SummaryTitleNoResults = () => (
  <div className="vscode-codeql__query-summary-container">
    <SectionTitle>No results found</SectionTitle>
  </div>
);

const SummaryItemDownload = ({
  analysisSummary,
  analysisResults
}: {
  analysisSummary: AnalysisSummary,
  analysisResults: AnalysisResults | undefined
}) => {
  if (!analysisResults || analysisResults.status === 'Failed') {
    return <DownloadButton
      text={analysisSummary.fileSize}
      onClick={() => downloadAnalysisResults(analysisSummary)} />;
  }

  if (analysisResults.status === 'InProgress') {
    return <>
      <HorizontalSpace size={2} />
      <DownloadSpinner />
    </>;
  }

  return (<></>);
};

const SummaryItem = ({
  analysisSummary,
  analysisResults
}: {
  analysisSummary: AnalysisSummary,
  analysisResults: AnalysisResults | undefined
}) => (
  <span>
    <span className="vscode-codeql__analysis-item">{octicons.repo}</span>
    <span className="vscode-codeql__analysis-item">{analysisSummary.nwo}</span>
    <span className="vscode-codeql__analysis-item"><Badge text={analysisSummary.resultCount.toString()} /></span>
    <span className="vscode-codeql__analysis-item">
      <SummaryItemDownload
        analysisSummary={analysisSummary}
        analysisResults={analysisResults} />
    </span>
  </span>
);

const Summary = ({
  queryResult,
  analysesResults
}: {
  queryResult: RemoteQueryResult,
  analysesResults: AnalysisResults[]
}) => {
  const [repoListExpanded, setRepoListExpanded] = useState(false);
  const numOfReposToShow = repoListExpanded ? queryResult.analysisSummaries.length : numOfReposInContractedMode;

  return (
    <>
      {
        queryResult.affectedRepositoryCount === 0
          ? <SummaryTitleNoResults />
          : <SummaryTitleWithResults
            queryResult={queryResult}
            analysesResults={analysesResults} />
      }

      <ul className="vscode-codeql__analysis-summaries-list">
        {queryResult.analysisSummaries.slice(0, numOfReposToShow).map((summary, i) =>
          <li key={summary.nwo} className="vscode-codeql__analysis-summaries-list-item">
            <SummaryItem
              analysisSummary={summary}
              analysisResults={analysesResults.find(a => a.nwo === summary.nwo)} />
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

const AnalysesResultsTitle = ({ totalAnalysesResults, totalResults }: { totalAnalysesResults: number, totalResults: number }) => {
  if (totalAnalysesResults === totalResults) {
    return <SectionTitle>{totalAnalysesResults} results</SectionTitle>;
  }

  return <SectionTitle>{totalAnalysesResults}/{totalResults} results</SectionTitle>;
};

const AnalysesResultsDescription = ({ totalAnalysesResults, totalResults }: { totalAnalysesResults: number, totalResults: number }) => {
  if (totalAnalysesResults < totalResults) {
    return <>
      <VerticalSpace size={1} />
      Some results haven&apos;t been downloaded automatically because of their size or because enough were downloaded already.
      Download them manually from the list above if you want to see them here.
    </>;
  }

  return <></>;
};

const AnalysesResults = ({ analysesResults, totalResults }: { analysesResults: AnalysisResults[], totalResults: number }) => {
  const totalAnalysesResults = sumAnalysesResults(analysesResults);

  if (totalResults === 0) {
    return <></>;
  }

  return (
    <>
      <VerticalSpace size={2} />
      <AnalysesResultsTitle
        totalAnalysesResults={totalAnalysesResults}
        totalResults={totalResults} />
      <AnalysesResultsDescription
        totalAnalysesResults={totalAnalysesResults}
        totalResults={totalResults} />
    </>
  );
};

export function RemoteQueries(): JSX.Element {
  const [queryResult, setQueryResult] = useState<RemoteQueryResult>(emptyQueryResult);
  const [analysesResults, setAnalysesResults] = useState<AnalysisResults[]>([]);

  useEffect(() => {
    window.addEventListener('message', (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToRemoteQueriesMessage = evt.data;
        if (msg.t === 'setRemoteQueryResult') {
          setQueryResult(msg.queryResult);
        } else if (msg.t === 'setAnalysesResults') {
          setAnalysesResults(msg.analysesResults);
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
      <ThemeProvider>
        <ViewTitle>{queryResult.queryTitle}</ViewTitle>
        <QueryInfo {...queryResult} />
        <Summary queryResult={queryResult} analysesResults={analysesResults} />
        <AnalysesResults analysesResults={analysesResults} totalResults={queryResult.totalResultCount} />
      </ThemeProvider>
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
