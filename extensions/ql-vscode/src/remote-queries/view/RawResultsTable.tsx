import * as React from 'react';
import { Box } from '@primer/react';
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import { CellValue, RawResultSet, ResultSetSchema } from '../../pure/bqrs-cli-types';
import { tryGetRemoteLocation } from '../../pure/bqrs-utils';
import { useState } from 'react';
import TextButton from './TextButton';
import { convertNonPrintableChars } from '../../text-utils';

const numOfResultsInContractedMode = 5;

const Row = ({
  row,
  fileLinkPrefix,
  sourceLocationPrefix
}: {
  row: CellValue[],
  fileLinkPrefix: string,
  sourceLocationPrefix: string
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
        <Cell value={cell} fileLinkPrefix={fileLinkPrefix} sourceLocationPrefix={sourceLocationPrefix} />
      </Box>
    ))}
  </>
);

const Cell = ({
  value,
  fileLinkPrefix,
  sourceLocationPrefix
}: {
  value: CellValue,
  fileLinkPrefix: string
  sourceLocationPrefix: string
}) => {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return <span>{convertNonPrintableChars(value.toString())}</span>;
    case 'object': {
      const url = tryGetRemoteLocation(value.url, fileLinkPrefix, sourceLocationPrefix);
      const safeLabel = convertNonPrintableChars(value.label);
      if (url) {
        return <VSCodeLink href={url}>{safeLabel}</VSCodeLink>;
      } else {
        return <span>{safeLabel}</span>;
      }
    }
  }
};

const RawResultsTable = ({
  schema,
  results,
  fileLinkPrefix,
  sourceLocationPrefix
}: {
  schema: ResultSetSchema,
  results: RawResultSet,
  fileLinkPrefix: string,
  sourceLocationPrefix: string
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
          <Row key={rowIndex} row={row} fileLinkPrefix={fileLinkPrefix} sourceLocationPrefix={sourceLocationPrefix} />
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
