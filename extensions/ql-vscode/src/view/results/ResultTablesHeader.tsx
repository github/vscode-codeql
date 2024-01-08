import { useCallback, useEffect, useState } from "react";
import { vscode } from "../vscode-api";
import { openFile, tableHeaderItemClassName } from "./result-table-utils";
import { sendTelemetry } from "../common/telemetry";
import type { ParsedResultSets } from "../../common/interface-types";
import { ALERTS_TABLE_NAME } from "../../common/interface-types";
import { basename } from "../../common/path";
import { styled } from "styled-components";
import TextButton from "../common/TextButton";

interface Props {
  queryName: string;
  queryPath: string;
  parsedResultSets: ParsedResultSets;
  selectedTable: string;
}

const Container = styled.span`
  display: flex;
  padding: 0.5em 0;
  align-items: center;
  top: 0;
  background-color: var(--vscode-editorGutter-background);
  position: sticky;
  z-index: 1;
`;

const PaginationButton = styled.button`
  padding: 0.3rem;
  margin: 0.2rem;
  border: 0;
  font-size: large;
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-editorGutter-background);
  cursor: pointer;
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }
`;

const PageNumberInput = styled.input`
  border-radius: 0;
  padding: 0.3rem;
  margin: 0.2rem;
  width: 2rem;
  color: var(--vscode-editor-foreground);
  border: 0;
  border-bottom: 1px solid var(--vscode-editor-foreground);
  background-color: var(--vscode-editorGutter-background);
  outline: none;
`;

const OpenQueryLink = styled(TextButton)`
  text-decoration: none;
`;

export function ResultTablesHeader(props: Props) {
  const { queryPath, queryName, parsedResultSets, selectedTable } = props;

  const [selectedPage, setSelectedPage] = useState(
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
    <Container>
      <PaginationButton onClick={prevPageHandler}>&#xab;</PaginationButton>
      <PageNumberInput
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
      <PaginationButton value=">" onClick={nextPageHandler}>
        &#xbb;
      </PaginationButton>
      <div className={tableHeaderItemClassName}>{queryName}</div>
      <div className={tableHeaderItemClassName}>
        <OpenQueryLink onClick={openQueryHandler}>
          Open {basename(queryPath)}
        </OpenQueryLink>
      </div>
    </Container>
  );
}

function sendResultsPageChangedTelemetry() {
  sendTelemetry("local-results-alert-table-page-changed");
}
