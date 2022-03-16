import * as React from 'react';
import { Box, Link } from '@primer/react';
import { CellValue, RawResultSet, ResultSetSchema } from '../../pure/bqrs-cli-types';
import { tryGetRemoteLocation } from '../../pure/bqrs-utils';
import { useState } from 'react';
import TextButton from './TextButton';
import { convertNonPrintableChars } from '../../text-utils';

const numOfResultsInContractedMode = 5;

const Row = ({
  row,
  fileLinkPrefix
}: {
  row: CellValue[],
  fileLinkPrefix: string
}) => (
  <>
    {row.map((cell, cellIndex) => (
      <Box key={cellIndex}
        borderColor="border.default"
        borderStyle="solid"
        justifyContent="center"
        alignItems="center"
        p={2}
        sx={{ wordBreak: 'break-word' }}>
        <Cell value={cell} fileLinkPrefix={fileLinkPrefix} />
      </Box>
    ))}
  </>
);

const Cell = ({
  value,
  fileLinkPrefix
}: {
  value: CellValue,
  fileLinkPrefix: string
}) => {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return <span>{convertNonPrintableChars(value.toString())}</span>;
    case 'object': {
      const url = tryGetRemoteLocation(value.url, fileLinkPrefix);
      return <Link href={url}>{convertNonPrintableChars(value.label)}</Link>;
    }
  }
};

const RawResultsTable = ({
  schema,
  results,
  fileLinkPrefix
}: {
  schema: ResultSetSchema,
  results: RawResultSet,
  fileLinkPrefix: string
}) => {
  const [tableExpanded, setTableExpanded] = useState(false);
  const numOfResultsToShow = tableExpanded ? results.rows.length : numOfResultsInContractedMode;
  const showButton = results.rows.length > numOfResultsInContractedMode;

  // Create n equal size columns. We use minmax(0, 1fr) because the
  // minimum width of 1fr is auto, not 0.
  // https://css-tricks.com/equal-width-columns-in-css-grid-are-kinda-weird/
  const gridTemplateColumns = `repeat(${schema.columns.length}, minmax(0, 1fr))`;

  return (
    <>
      <Box
        display="grid"
        gridTemplateColumns={gridTemplateColumns}
        maxWidth="45rem"
        p={2}>
        {results.rows.slice(0, numOfResultsToShow).map((row, rowIndex) => (
          <Row key={rowIndex} row={row} fileLinkPrefix={fileLinkPrefix} />
        ))}
      </Box>
      {
        showButton &&
        <TextButton size='x-small' onClick={() => setTableExpanded(!tableExpanded)}>
          {tableExpanded ? (<span>View less</span>) : (<span>View all</span>)}
        </TextButton>
      }
    </>
  );
};

export default RawResultsTable;
