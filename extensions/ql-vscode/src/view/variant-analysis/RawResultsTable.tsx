import { useState } from "react";
import { styled } from "styled-components";
import TextButton from "../common/TextButton";
import { useTelemetryOnChange } from "../common/telemetry";
import type { RawResultSet } from "../../common/raw-result-types";
import { RawResultRow } from "./RawResultRow";

const numOfResultsInContractedMode = 5;

type TableContainerProps = {
  $columnCount: number;
};

const TableContainer = styled.div<TableContainerProps>`
  display: grid;
  // Create n equal size columns. We use minmax(0, 1fr) because the
  // minimum width of 1fr is auto, not 0.
  // https://css-tricks.com/equal-width-columns-in-css-grid-are-kinda-weird/
  grid-template-columns: repeat(
    ${(props) => props.$columnCount},
    minmax(0, 1fr)
  );
  max-width: 45rem;
  padding: 0.4rem;
`;

type RawResultsTableProps = {
  resultSet: RawResultSet;
  fileLinkPrefix: string;
  sourceLocationPrefix: string;
};

const filterTableExpandedTelemetry = (v: boolean) => v;

const RawResultsTable = ({
  resultSet,
  fileLinkPrefix,
  sourceLocationPrefix,
}: RawResultsTableProps) => {
  const [tableExpanded, setTableExpanded] = useState(false);
  useTelemetryOnChange(tableExpanded, "raw-results-table-expanded", {
    filterTelemetryOnValue: filterTableExpandedTelemetry,
  });
  const numOfResultsToShow = tableExpanded
    ? resultSet.rows.length
    : numOfResultsInContractedMode;
  const showButton = resultSet.rows.length > numOfResultsInContractedMode;

  return (
    <>
      <TableContainer $columnCount={resultSet.columns.length}>
        {resultSet.rows.slice(0, numOfResultsToShow).map((row, rowIndex) => (
          <RawResultRow
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
