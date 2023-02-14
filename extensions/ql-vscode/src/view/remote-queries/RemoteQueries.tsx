import * as React from "react";
import { useEffect, useState } from "react";
import { Flash, ThemeProvider } from "@primer/react";
import { ToRemoteQueriesMessage } from "../../pure/interface-types";
import {
  AnalysisSummary,
  RemoteQueryResult,
} from "../../remote-queries/shared/remote-query-result";
import { MAX_RAW_RESULTS } from "../../remote-queries/shared/result-limits";
import { vscode } from "../vscode-api";
import { VSCodeBadge, VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import {
  HorizontalSpace,
  SectionTitle,
  VerticalSpace,
  ViewTitle,
} from "../common";
import DownloadButton from "./DownloadButton";
import {
  AnalysisResults,
  getAnalysisResultCount,
} from "../../remote-queries/shared/analysis-result";
import DownloadSpinner from "./DownloadSpinner";
import CollapsibleItem from "./CollapsibleItem";
import {
  AlertIcon,
  CodeSquareIcon,
  FileCodeIcon,
  RepoIcon,
  TerminalIcon,
} from "@primer/octicons-react";
import AnalysisAlertResult from "../variant-analysis/AnalysisAlertResult";
import RawResultsTable from "../variant-analysis/RawResultsTable";
import RepositoriesSearch from "./RepositoriesSearch";
import StarCount from "../common/StarCount";
import SortRepoFilter, { Sort, sorter } from "./SortRepoFilter";
import LastUpdated from "./LastUpdated";
import RepoListCopyButton from "./RepoListCopyButton";

import "./baseStyles.css";
import "./remoteQueries.css";

const numOfReposInContractedMode = 10;

const emptyQueryResult: RemoteQueryResult = {
  queryId: "",
  queryTitle: "",
  queryFileName: "",
  queryFilePath: "",
  queryText: "",
  language: "",
  workflowRunUrl: "",
  totalRepositoryCount: 0,
  affectedRepositoryCount: 0,
  totalResultCount: 0,
  executionTimestamp: "",
  executionDuration: "",
  analysisSummaries: [],
  analysisFailures: [],
};

const downloadAnalysisResults = (analysisSummary: AnalysisSummary) => {
  vscode.postMessage({
    t: "remoteQueryDownloadAnalysisResults",
    analysisSummary,
  });
};

const downloadAllAnalysesResults = (query: RemoteQueryResult) => {
  vscode.postMessage({
    t: "remoteQueryDownloadAllAnalysesResults",
    analysisSummaries: query.analysisSummaries,
  });
};

const openQueryFile = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: "openFile",
    filePath: queryResult.queryFilePath,
  });
};

const openQueryTextVirtualFile = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: "openVirtualFile",
    queryText: queryResult.queryText,
  });
};

function createResultsDescription(queryResult: RemoteQueryResult) {
  const reposCount = `${queryResult.totalRepositoryCount} ${
    queryResult.totalRepositoryCount === 1 ? "repository" : "repositories"
  }`;
  return `${queryResult.totalResultCount} results from running against ${reposCount} (${queryResult.executionDuration}), ${queryResult.executionTimestamp}`;
}

const sumAnalysesResults = (analysesResults: AnalysisResults[]) =>
  analysesResults.reduce((acc, curr) => acc + getAnalysisResultCount(curr), 0);

const QueryInfo = (queryResult: RemoteQueryResult) => (
  <>
    <VerticalSpace size={1} />
    {createResultsDescription(queryResult)}
    <VerticalSpace size={1} />
    <span>
      <a
        className="vscode-codeql__query-info-link"
        href="#"
        onClick={() => openQueryFile(queryResult)}
      >
        <span>
          {" "}
          <FileCodeIcon size={16} />{" "}
        </span>
        {queryResult.queryFileName}
      </a>
    </span>
    <span>
      <a
        className="vscode-codeql__query-info-link"
        href="#"
        onClick={() => openQueryTextVirtualFile(queryResult)}
      >
        <span>
          {" "}
          <CodeSquareIcon size={16} />{" "}
        </span>
        Query
      </a>
    </span>
    <span>
      <a
        className="vscode-codeql__query-info-link"
        href={queryResult.workflowRunUrl}
      >
        <span>
          {" "}
          <TerminalIcon size={16} />{" "}
        </span>
        Logs
      </a>
    </span>
  </>
);

const Failures = (queryResult: RemoteQueryResult) => {
  if (queryResult.analysisFailures.length === 0) {
    return <></>;
  }
  return (
    <>
      <VerticalSpace size={3} />
      <Flash variant="danger">
        {queryResult.analysisFailures.map((f, i) => (
          <div key={i}>
            <p className="vscode-codeql__analysis-failure">
              <AlertIcon size={16} />
              <b>{f.nwo}: </b>
              {f.error}
            </p>
            {i === queryResult.analysisFailures.length - 1 ? (
              <></>
            ) : (
              <VerticalSpace size={1} />
            )}
          </div>
        ))}
      </Flash>
    </>
  );
};

const SummaryTitleWithResults = ({
  queryResult,
  analysesResults,
  sort,
  setSort,
}: {
  queryResult: RemoteQueryResult;
  analysesResults: AnalysisResults[];
  sort: Sort;
  setSort: (sort: Sort) => void;
}) => {
  const showDownloadButton =
    queryResult.totalResultCount !== sumAnalysesResults(analysesResults);

  return (
    <div className="vscode-codeql__query-summary-container">
      <SectionTitle>
        Repositories with results ({queryResult.affectedRepositoryCount}):
      </SectionTitle>
      {showDownloadButton && (
        <DownloadButton
          text="Download all"
          onClick={() => downloadAllAnalysesResults(queryResult)}
        />
      )}
      <div style={{ flexGrow: 2, textAlign: "right" }}>
        <RepoListCopyButton queryResult={queryResult} />
        <HorizontalSpace size={1} />
        <SortRepoFilter sort={sort} setSort={setSort} />
      </div>
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
  analysisResults,
}: {
  analysisSummary: AnalysisSummary;
  analysisResults: AnalysisResults | undefined;
}) => {
  if (!analysisResults || analysisResults.status === "Failed") {
    return (
      <DownloadButton
        text={analysisSummary.fileSize}
        onClick={() => downloadAnalysisResults(analysisSummary)}
      />
    );
  }

  if (analysisResults.status === "InProgress") {
    return (
      <>
        <HorizontalSpace size={2} />
        <DownloadSpinner />
      </>
    );
  }

  return <></>;
};

const SummaryItem = ({
  analysisSummary,
  analysisResults,
}: {
  analysisSummary: AnalysisSummary;
  analysisResults: AnalysisResults | undefined;
}) => (
  <>
    <span className="vscode-codeql__analysis-item">
      <RepoIcon size={16} />
    </span>
    <span className="vscode-codeql__analysis-item">{analysisSummary.nwo}</span>
    <HorizontalSpace size={1} />
    <span className="vscode-codeql__analysis-item">
      <VSCodeBadge>{analysisSummary.resultCount.toString()}</VSCodeBadge>
    </span>
    <span className="vscode-codeql__analysis-item">
      <SummaryItemDownload
        analysisSummary={analysisSummary}
        analysisResults={analysisResults}
      />
    </span>
    <StarCount starCount={analysisSummary.starCount} />
    <LastUpdated lastUpdated={analysisSummary.lastUpdated} />
  </>
);

const Summary = ({
  queryResult,
  analysesResults,
  sort,
  setSort,
}: {
  queryResult: RemoteQueryResult;
  analysesResults: AnalysisResults[];
  sort: Sort;
  setSort: (sort: Sort) => void;
}) => {
  const [repoListExpanded, setRepoListExpanded] = useState(false);
  const numOfReposToShow = repoListExpanded
    ? queryResult.analysisSummaries.length
    : numOfReposInContractedMode;

  return (
    <>
      {queryResult.affectedRepositoryCount === 0 ? (
        <SummaryTitleNoResults />
      ) : (
        <SummaryTitleWithResults
          queryResult={queryResult}
          analysesResults={analysesResults}
          sort={sort}
          setSort={setSort}
        />
      )}

      <ul className="vscode-codeql__flat-list">
        {queryResult.analysisSummaries
          .slice(0, numOfReposToShow)
          .sort(sorter(sort))
          .map((summary, i) => (
            <li
              key={summary.nwo}
              className="vscode-codeql__analysis-summaries-list-item"
            >
              <SummaryItem
                analysisSummary={summary}
                analysisResults={analysesResults.find(
                  (a) => a.nwo === summary.nwo,
                )}
              />
            </li>
          ))}
      </ul>
      {queryResult.analysisSummaries.length > numOfReposInContractedMode && (
        <button
          className="vscode-codeql__expand-button"
          onClick={() => setRepoListExpanded(!repoListExpanded)}
        >
          {repoListExpanded ? <span>View less</span> : <span>View all</span>}
        </button>
      )}
    </>
  );
};

const AnalysesResultsTitle = ({
  totalAnalysesResults,
  totalResults,
}: {
  totalAnalysesResults: number;
  totalResults: number;
}) => {
  if (totalAnalysesResults === totalResults) {
    return <SectionTitle>{totalAnalysesResults} results</SectionTitle>;
  }

  return (
    <SectionTitle>
      {totalAnalysesResults}/{totalResults} results
    </SectionTitle>
  );
};

const exportResults = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: "remoteQueryExportResults",
    queryId: queryResult.queryId,
  });
};

const AnalysesResultsDescription = ({
  queryResult,
  analysesResults,
}: {
  queryResult: RemoteQueryResult;
  analysesResults: AnalysisResults[];
}) => {
  const showDownloadsMessage = queryResult.analysisSummaries.some(
    (s) =>
      !analysesResults.some((a) => a.nwo === s.nwo && a.status === "Completed"),
  );
  const downloadsMessage = (
    <>
      <VerticalSpace size={1} />
      Some results haven&apos;t been downloaded automatically because of their
      size or because enough were downloaded already. Download them manually
      from the list above if you want to see them here.
    </>
  );

  const showMaxResultsMessage = analysesResults.some(
    (a) => a.rawResults?.capped,
  );
  const maxRawResultsMessage = (
    <>
      <VerticalSpace size={1} />
      Some repositories have more than {MAX_RAW_RESULTS} results. We will only
      show you up to&nbsp;
      {MAX_RAW_RESULTS} results for each repository.
    </>
  );

  return (
    <>
      {showDownloadsMessage && downloadsMessage}
      {showMaxResultsMessage && maxRawResultsMessage}
    </>
  );
};

const RepoAnalysisResults = (analysisResults: AnalysisResults) => {
  const numOfResults = getAnalysisResultCount(analysisResults);
  const title = (
    <>
      {analysisResults.nwo}
      <HorizontalSpace size={1} />
      <VSCodeBadge>{numOfResults.toString()}</VSCodeBadge>
    </>
  );

  return (
    <CollapsibleItem title={title}>
      <ul className="vscode-codeql__flat-list">
        {analysisResults.interpretedResults.map((r, i) => (
          <li key={i}>
            <AnalysisAlertResult alert={r} />
            <VerticalSpace size={2} />
          </li>
        ))}
      </ul>
      {analysisResults.rawResults && (
        <RawResultsTable
          schema={analysisResults.rawResults.schema}
          results={analysisResults.rawResults.resultSet}
          fileLinkPrefix={analysisResults.rawResults.fileLinkPrefix}
          sourceLocationPrefix={analysisResults.rawResults.sourceLocationPrefix}
        />
      )}
    </CollapsibleItem>
  );
};

const AnalysesResults = ({
  queryResult,
  analysesResults,
  totalResults,
  sort,
}: {
  queryResult: RemoteQueryResult;
  analysesResults: AnalysisResults[];
  totalResults: number;
  sort: Sort;
}) => {
  const totalAnalysesResults = sumAnalysesResults(analysesResults);
  const [filterValue, setFilterValue] = useState("");

  if (totalResults === 0) {
    return <></>;
  }

  return (
    <>
      <VerticalSpace size={2} />
      <div style={{ display: "flex" }}>
        <div style={{ flexGrow: 1 }}>
          <AnalysesResultsTitle
            totalAnalysesResults={totalAnalysesResults}
            totalResults={totalResults}
          />
        </div>
        <div>
          <VSCodeButton onClick={() => exportResults(queryResult)}>
            Export all
          </VSCodeButton>
        </div>
      </div>
      <AnalysesResultsDescription
        queryResult={queryResult}
        analysesResults={analysesResults}
      />

      <VerticalSpace size={2} />
      <RepositoriesSearch
        filterValue={filterValue}
        setFilterValue={setFilterValue}
      />

      <ul className="vscode-codeql__flat-list">
        {analysesResults
          .filter(
            (a) =>
              a.interpretedResults.length ||
              a.rawResults?.resultSet?.rows?.length,
          )
          .filter((a) =>
            a.nwo.toLowerCase().includes(filterValue.toLowerCase()),
          )
          .sort(sorter(sort))
          .map((r) => (
            <li
              key={r.nwo}
              className="vscode-codeql__analyses-results-list-item"
            >
              <RepoAnalysisResults {...r} />
            </li>
          ))}
      </ul>
    </>
  );
};

export function RemoteQueries(): JSX.Element {
  const [queryResult, setQueryResult] =
    useState<RemoteQueryResult>(emptyQueryResult);
  const [analysesResults, setAnalysesResults] = useState<AnalysisResults[]>([]);
  const [sort, setSort] = useState<Sort>("name");

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToRemoteQueriesMessage = evt.data;
        if (msg.t === "setRemoteQueryResult") {
          setQueryResult(msg.queryResult);
        } else if (msg.t === "setAnalysesResults") {
          setAnalysesResults(msg.analysesResults);
        }
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  if (!queryResult) {
    return <div>Waiting for results to load.</div>;
  }

  try {
    return (
      <div className="vscode-codeql__remote-queries">
        <ThemeProvider colorMode="auto">
          <ViewTitle>{queryResult.queryTitle}</ViewTitle>
          <QueryInfo {...queryResult} />
          <Failures {...queryResult} />
          <Summary
            queryResult={queryResult}
            analysesResults={analysesResults}
            sort={sort}
            setSort={setSort}
          />
          <AnalysesResults
            queryResult={queryResult}
            analysesResults={analysesResults}
            totalResults={queryResult.totalResultCount}
            sort={sort}
          />
        </ThemeProvider>
      </div>
    );
  } catch (err) {
    console.error(err);
    return <div>There was an error displaying the view.</div>;
  }
}
