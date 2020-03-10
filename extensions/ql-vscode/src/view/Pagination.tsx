import * as React from 'react';

interface ShowPaginationProps {
  totalResultsCount: number;
  displayedResultsCount: number;
  pageSize: number;
  requestMoreResults: (from: number, count: number) => Promise<void>;
}


export default function Pagination(props: ShowPaginationProps): JSX.Element {
  const of = props.totalResultsCount > props.displayedResultsCount ? `of ${props.totalResultsCount}` : '';
  const showing = `Showing ${props.displayedResultsCount} ${props.displayedResultsCount === 1 ? 'result' : 'results'}`;

  let more;
  if (props.totalResultsCount > props.displayedResultsCount) {
    more = (
      <button onClick={() => props.requestMoreResults(props.displayedResultsCount, props.pageSize)}>
        Load more...
      </button>
    );
  }

  return (
    <div className="vscode-codeql__pagination">
      <span>{showing} {of}</span>
      {more}
    </div>
  );
}
