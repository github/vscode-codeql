import * as React from 'react';
import styled from 'styled-components';

import { HighlightedRegion } from '../../../remote-queries/shared/analysis-result';
import { parseHighlightedLine, shouldHighlightLine } from '../../../pure/sarif-utils';

const replaceSpaceAndTabChar = (text: string) => text.replaceAll(' ', '\u00a0').replaceAll('\t', '\u00a0\u00a0\u00a0\u00a0');

const HighlightedSpan = styled.span`
  background-color: var(--vscode-editor-findMatchHighlightBackground);
`;

const PlainCode = ({ text }: { text: string }) => {
  return <span>{replaceSpaceAndTabChar(text)}</span>;
};

const HighlightedCode = ({ text }: { text: string }) => {
  return <HighlightedSpan>{replaceSpaceAndTabChar(text)}</HighlightedSpan>;
};

export const CodeSnippetCode = ({
  line,
  lineNumber,
  highlightedRegion
}: {
  line: string,
  lineNumber: number,
  highlightedRegion?: HighlightedRegion
}) => {
  if (!highlightedRegion || !shouldHighlightLine(lineNumber, highlightedRegion)) {
    return <PlainCode text={line} />;
  }

  const partiallyHighlightedLine = parseHighlightedLine(line, lineNumber, highlightedRegion);

  return (
    <>
      <PlainCode text={partiallyHighlightedLine.plainSection1} />
      <HighlightedCode text={partiallyHighlightedLine.highlightedSection} />
      <PlainCode text={partiallyHighlightedLine.plainSection2} />
    </>
  );
};
