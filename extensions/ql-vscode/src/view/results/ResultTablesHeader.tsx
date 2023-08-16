import * as React from "react";
import { useCallback, useEffect } from "react";
import { vscode } from "../vscode-api";
import { openFile, tableHeaderItemClassName } from "./result-table-utils";
import { sendTelemetry } from "../common/telemetry";
import {
  ALERTS_TABLE_NAME,
  ParsedResultSets,
} from "../../common/interface-types";
import { basename } from "../../common/path";
import { styled } from "styled-components";
import TextButton from "../common/TextButton";

interface Props {
  queryName: string;
  queryPath: string;
  parsedResultSets: ParsedResultSets;
  selectedTable: string;
}

const OpenQueryLink = styled(TextButton)`
  text-decoration: none;
`;

export function ResultTablesHeader(props: Props) {
  const { queryPath, queryName, parsedResultSets, selectedTable } = props;

  const [selectedPage, setSelectedPage] = React.useState(
    `${parsedResultSets.pageNumber + 1}`,
  );
  useEffect(() => {
    setSelectedPage(`${parsedResultSets.pageNumber + 1}`);
  }, [parsedResultSets.pageNumber]);

  // FIXME: The extension, not the view, should be in charge of deciding whether to initially show
  // a raw or alerts page. We have to conditionally recompute the number of pages here, because
  // on initial load of query results, resultSets.numPages will have the number of *raw* pages available,
  // not interpreted pages, because the extension doesn't know the view will default to showing alerts
  // instead.
  const numPages = Math.max(
    selectedTable === ALERTS_TABLE_NAME
      ? parsedResultSets.numInterpretedPages
      : parsedResultSets.numPages,
    1,
  );

  const onChangeHandler = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedPage(e.target.value);
      sendResultsPageChangedTelemetry();
    },
    [],
  );

  const changePage = useCallback(
    (value: string) => {
      const pageNumber = parseInt(value);
      if (pageNumber !== undefined && !isNaN(pageNumber)) {
        const actualPageNumber = Math.max(
          0,
          Math.min(pageNumber - 1, numPages - 1),
        );
        vscode.postMessage({
          t: "changePage",
          pageNumber: actualPageNumber,
          selectedTable,
        });
      }
    },
    [numPages, selectedTable],
  );

  const onBlurHandler = useCallback(
    (e: React.FocusEvent<HTMLInputElement, Element>) => {
      changePage(e.target.value);
    },
    [changePage],
  );

  const onKeyDownHandler = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        changePage(e.currentTarget.value);
      }
    },
    [changePage],
  );

  const prevPageHandler = useCallback(() => {
    vscode.postMessage({
      t: "changePage",
      pageNumber: Math.max(parsedResultSets.pageNumber - 1, 0),
      selectedTable,
    });
    sendResultsPageChangedTelemetry();
  }, [parsedResultSets.pageNumber, selectedTable]);

  const nextPageHandler = useCallback(() => {
    vscode.postMessage({
      t: "changePage",
      pageNumber: Math.min(parsedResultSets.pageNumber + 1, numPages - 1),
      selectedTable,
    });
    sendResultsPageChangedTelemetry();
  }, [numPages, parsedResultSets.pageNumber, selectedTable]);

  const openQueryHandler = useCallback(() => {
    openFile(queryPath);
    sendTelemetry("local-results-open-query-file");
  }, [queryPath]);

  return (
    <span className="vscode-codeql__table-selection-pagination">
      <button onClick={prevPageHandler}>&#xab;</button>
      <input
        type="number"
        size={3}
        value={selectedPage}
        min="1"
        max={numPages}
        onChange={onChangeHandler}
        onBlur={onBlurHandler}
        onKeyDown={onKeyDownHandler}
      />
      <span>/&nbsp;{numPages}</span>
      <button value=">" onClick={nextPageHandler}>
        &#xbb;
      </button>
      <div className={tableHeaderItemClassName}>{queryName}</div>
      <div className={tableHeaderItemClassName}>
        <OpenQueryLink onClick={openQueryHandler}>
          Open {basename(queryPath)}
        </OpenQueryLink>
      </div>
    </span>
  );
}

function sendResultsPageChangedTelemetry() {
  sendTelemetry("local-results-alert-table-page-changed");
}
