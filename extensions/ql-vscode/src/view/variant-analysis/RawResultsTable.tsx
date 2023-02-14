import * as React from "react";
import { useState } from "react";
import styled from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import {
  CellValue,
  RawResultSet,
  ResultSetSchema,
} from "../../pure/bqrs-cli-types";
import { tryGetRemoteLocation } from "../../pure/bqrs-utils";
import TextButton from "../common/TextButton";
import { convertNonPrintableChars } from "../../text-utils";
import { sendTelemetry, useTelemetryOnChange } from "../common/telemetry";

const numOfResultsInContractedMode = 5;

const StyledRow = styled.div`
  border-color: var(--vscode-editor-snippetFinalTabstopHighlightBorder);
  border-style: solid;
  justify-content: center;
  align-items: center;
  padding: 0.4rem;
  word-break: break-word;
`;

type TableContainerProps = {
  columnCount: number;
};

const TableContainer = styled.div<TableContainerProps>`
  display: grid;
  // Create n equal size columns. We use minmax(0, 1fr) because the
  // minimum width of 1fr is auto, not 0.
  // https://css-tricks.com/equal-width-columns-in-css-grid-are-kinda-weird/
  grid-template-columns: repeat(
    ${(props) => props.columnCount},
    minmax(0, 1fr)
  );
  max-width: 45rem;
  padding: 0.4rem;
`;

type CellProps = {
  value: CellValue;
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
};

const sendRawResultsLinkTelemetry = () => sendTelemetry("raw-results-link");

const Cell = ({ value, fileLinkPrefix, sourceLocationPrefix }: CellProps) => {
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return <span>{convertNonPrintableChars(value.toString())}</span>;
    case "object": {
      const url = tryGetRemoteLocation(
        value.url,
        fileLinkPrefix,
        sourceLocationPrefix,
      );
      const safeLabel = convertNonPrintableChars(value.label);
      if (url) {
        return (
          <VSCodeLink onClick={sendRawResultsLinkTelemetry} href={url}>
            {safeLabel}
          </VSCodeLink>
        );
      } else {
        return <span>{safeLabel}</span>;
      }
    }
  }
};

type RowProps = {
  row: CellValue[];
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
};

const Row = ({ row, fileLinkPrefix, sourceLocationPrefix }: RowProps) => (
  <>
    {row.map((cell, cellIndex) => (
      <StyledRow key={cellIndex}>
        <Cell
          value={cell}
          fileLinkPrefix={fileLinkPrefix}
          sourceLocationPrefix={sourceLocationPrefix}
        />
      </StyledRow>
    ))}
  </>
);

type RawResultsTableProps = {
  schema: ResultSetSchema;
  results: RawResultSet;
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
};

const filterTableExpandedTelemetry = (v: boolean) => v;

const RawResultsTable = ({
  schema,
  results,
  fileLinkPrefix,
  sourceLocationPrefix,
}: RawResultsTableProps) => {
  const [tableExpanded, setTableExpanded] = useState(false);
  useTelemetryOnChange(tableExpanded, "raw-results-table-expanded", {
    filterTelemetryOnValue: filterTableExpandedTelemetry,
  });
  const numOfResultsToShow = tableExpanded
    ? results.rows.length
    : numOfResultsInContractedMode;
  const showButton = results.rows.length > numOfResultsInContractedMode;

  return (
    <>
      <TableContainer columnCount={schema.columns.length}>
        {results.rows.slice(0, numOfResultsToShow).map((row, rowIndex) => (
          <Row
            key={rowIndex}
            row={row}
            fileLinkPrefix={fileLinkPrefix}
            sourceLocationPrefix={sourceLocationPrefix}
          />
        ))}
      </TableContainer>
      {showButton && (
        <TextButton
          size="x-small"
          onClick={() => setTableExpanded(!tableExpanded)}
        >
          {tableExpanded ? <span>View less</span> : <span>View all</span>}
        </TextButton>
      )}
    </>
  );
};

export default RawResultsTable;
