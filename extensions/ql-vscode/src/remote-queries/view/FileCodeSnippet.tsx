import * as React from 'react';
import styled from 'styled-components';
import { CodeSnippet, HighlightedRegion, ResultSeverity } from '../shared/analysis-result';
import { Box, Link } from '@primer/react';
import VerticalSpace from './VerticalSpace';

const borderColor = 'var(--vscode-editor-snippetFinalTabstopHighlightBorder)';
const warningColor = '#966C23';
const highlightColor = '#534425';

const getSeverityColor = (severity: ResultSeverity) => {
  switch (severity) {
    case 'Recommendation':
      return 'blue';
    case 'Warning':
      return warningColor;
    case 'Error':
      return 'red';
  }
};

const replaceSpaceChar = (text: string) => text.replaceAll(' ', '\u00a0');

const shouldHighlightLine = (lineNumber: number, highlightedRegion: HighlightedRegion) => {
  if (lineNumber < highlightedRegion.startLine) {
    return false;
  }

  if (highlightedRegion.endLine == undefined) {
    return lineNumber == highlightedRegion.startLine;
  }

  return lineNumber <= highlightedRegion.endLine;
};

const Container = styled.div`
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  font-size: x-small;
  width: 55em;
`;

const TitleContainer = styled.div`
  border: 0.1em solid ${borderColor};
  border-top-left-radius: 0.2em;
  border-top-right-radius: 0.2em;
  padding: 0.5em;
`;

const CodeContainer = styled.div`
  border-left: 0.1em solid ${borderColor};
  border-right: 0.1em solid ${borderColor};
  border-bottom: 0.1em solid ${borderColor};
  border-bottom-left-radius: 0.2em;
  border-bottom-right-radius: 0.2em;
  padding-top: 1em;
  padding-bottom: 1em;
`;

const MessageText = styled.div`
  font-size: x-small;
  padding-left: 0.5em;
`;

const MessageContainer = styled.div`
  padding-top: 0.5em;
  padding-bottom: 0.5em;
`;

const PlainLine = ({ text }: { text: string }) => {
  return <span>{replaceSpaceChar(text)}</span>;
};

const HighlightedLine = ({ text }: { text: string }) => {
  return <span style={{ backgroundColor: highlightColor }}>{replaceSpaceChar(text)}</span>;
};

const Message = ({
  messageText,
  currentLineNumber,
  highlightedRegion,
  borderColor,
  children
}: {
  messageText: string,
  currentLineNumber: number,
  highlightedRegion: HighlightedRegion,
  borderColor: string,
  children: React.ReactNode
}) => {
  if (highlightedRegion.startLine !== currentLineNumber) {
    return <></>;
  }

  return <MessageContainer>
    <Box
      borderColor="border.default"
      borderWidth={1}
      borderStyle="solid"
      borderLeftColor={borderColor}
      borderLeftWidth={3}
      paddingTop="1em"
      paddingBottom="1em">
      <MessageText>
        {messageText}
        {children && <>
          <VerticalSpace size={2} />
          {children}
        </>
        }
      </MessageText>
    </Box>

  </MessageContainer>;
};

const CodeLine = ({
  line,
  lineNumber,
  highlightedRegion
}: {
  line: string,
  lineNumber: number,
  highlightedRegion: HighlightedRegion
}) => {
  if (!shouldHighlightLine(lineNumber, highlightedRegion)) {
    return <PlainLine text={line} />;
  }

  const isSingleLineHighlight = highlightedRegion.endLine === undefined;
  const isFirstHighlightedLine = lineNumber === highlightedRegion.startLine;
  const isLastHighlightedLine = lineNumber === highlightedRegion.endLine;

  const highlightStartColumn = isSingleLineHighlight
    ? highlightedRegion.startColumn
    : isFirstHighlightedLine
      ? highlightedRegion.startColumn
      : 0;

  const highlightEndColumn = isSingleLineHighlight
    ? highlightedRegion.endColumn
    : isLastHighlightedLine
      ? highlightedRegion.endColumn
      : line.length;

  const section1 = line.substring(0, highlightStartColumn - 1);
  const section2 = line.substring(highlightStartColumn - 1, highlightEndColumn - 1);
  const section3 = line.substring(highlightEndColumn - 1, line.length);

  return (
    <>
      <PlainLine text={section1} />
      <HighlightedLine text={section2} />
      <PlainLine text={section3} />
    </>
  );
};

const FileCodeSnippet = ({
  filePath,
  codeSnippet,
  highlightedRegion,
  severity,
  message,
  messageChildren,
}: {
  filePath: string,
  codeSnippet: CodeSnippet,
  highlightedRegion: HighlightedRegion,
  severity?: ResultSeverity,
  message?: string,
  messageChildren?: React.ReactNode,
}) => {

  const code = codeSnippet.text.split('\n');

  const startingLine = codeSnippet.startLine;

  return (
    <Container>
      <TitleContainer>
        <Link>{filePath}</Link>
      </TitleContainer>
      <CodeContainer>
        {code.map((line, index) => (
          <div key={index}>
            {message && severity && <Message
              messageText={message}
              currentLineNumber={startingLine + index}
              highlightedRegion={highlightedRegion}
              borderColor={getSeverityColor(severity)}>
              {messageChildren}
            </Message>}
            <Box display="flex">
              <Box
                p={2}
                borderStyle="none"
                paddingTop="0.01em"
                paddingLeft="0.5em"
                paddingRight="0.5em"
                paddingBottom="0.2em">
                {startingLine + index}
              </Box>
              <Box
                flexGrow={1}
                p={2}
                borderStyle="none"
                paddingTop="0.01em"
                paddingLeft="1.5em"
                paddingRight="0.5em"
                paddingBottom="0.2em">
                <CodeLine
                  line={line}
                  lineNumber={startingLine + index}
                  highlightedRegion={highlightedRegion} />
              </Box>
            </Box>
          </div>
        ))}
      </CodeContainer>
    </Container>
  );
};

export default FileCodeSnippet;
