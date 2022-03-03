import * as React from 'react';
import styled from 'styled-components';
import { Box, Link } from '@primer/react';
import { AnalysisAlert, HighlightedRegion, ResultSeverity } from '../shared/analysis-result';

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

const Container = styled.div`
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
`;

const TitleContainer = styled.div`
  border: 0.1em solid ${borderColor};
  border-top-left-radius: 0.2em;
  border-top-right-radius: 0.2em;
  padding: 0.5em;
`;

const CodeContainer = styled.div`
  font-size: x-small;
  border-left: 0.1em solid ${borderColor};
  border-right: 0.1em solid ${borderColor};
  border-bottom: 0.1em solid ${borderColor};
  border-bottom-left-radius: 0.2em;
  border-bottom-right-radius: 0.2em;
  padding-top: 1em;
  padding-bottom: 1em;
`;

const MessageText = styled.span<{ severity: ResultSeverity }>`
  font-size: x-small;
  color: ${props => getSeverityColor(props.severity)};
  padding-left: 0.5em;
`;

const MessageContainer = styled.div`
  padding-top: 0.5em;
  padding-bottom: 0.5em;
`;

const Message = ({ alert, currentLineNumber }: {
  alert: AnalysisAlert,
  currentLineNumber: number
}) => {
  if (alert.highlightedRegion.startLine !== currentLineNumber) {
    return <></>;
  }
  return <MessageContainer>
    <Box
      borderColor="border.default"
      borderWidth={1}
      borderStyle="solid"
      borderLeftColor={getSeverityColor(alert.severity)}
      borderLeftWidth={3}
      paddingTop="1em"
      paddingBottom="1em">
      <MessageText severity={alert.severity}>{alert.message}</MessageText>
    </Box>

  </MessageContainer>;
};

const replaceSpaceChar = (text: string) => text.replaceAll(' ', '\u00a0');

const PlainLine = ({ text }: { text: string }) => {
  return <span>{replaceSpaceChar(text)}</span>;
};

const HighlightedLine = ({ text }: { text: string }) => {
  return <span style={{ backgroundColor: highlightColor }}>{replaceSpaceChar(text)}</span>;
};

const shouldHighlightLine = (lineNumber: number, highlightedRegion: HighlightedRegion) => {
  if (lineNumber < highlightedRegion.startLine) {
    return false;
  }

  if (highlightedRegion.endLine) {
    return lineNumber <= highlightedRegion.endLine;
  }

  return true;
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

  const section1 = line.substring(0, highlightedRegion.startColumn - 1);
  const section2 = line.substring(highlightedRegion.startColumn - 1, highlightedRegion.endColumn - 1);
  const section3 = line.substring(highlightedRegion.endColumn - 1, line.length);

  return (
    <>
      <PlainLine text={section1} />
      <HighlightedLine text={section2} />
      <PlainLine text={section3} />
    </>
  );
};

const AnalysisAlertResult = ({ alert }: { alert: AnalysisAlert }) => {
  const code = alert.codeSnippet.text
    .split('\n')
    .filter(line => line.replace('\n', '').length > 0);

  const startingLine = alert.codeSnippet.startLine;

  return (
    <Container>
      <TitleContainer>
        <Link>{alert.filePath}</Link>
      </TitleContainer>
      <CodeContainer>
        {code.map((line, index) => (
          <div key={index}>
            <Message alert={alert} currentLineNumber={startingLine + index} />
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
                  highlightedRegion={alert.highlightedRegion} />
              </Box>
            </Box>
          </div>
        ))}
      </CodeContainer>
    </Container>
  );
};

export default AnalysisAlertResult;
