import * as React from 'react';
import styled from 'styled-components';
import { Box, Link } from '@primer/react';
import { AnalysisAlert, ResultSeverity } from '../shared/analysis-result';

const borderColor = 'var(--vscode-editor-snippetFinalTabstopHighlightBorder)';
const warningColor = '#966C23';

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
`;

const MessageText = styled.span<{ severity: ResultSeverity }>`
  font-size: x-small;
  color: ${props => `${getSeverityColor(props.severity)}`};
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
  if (alert.codeRegion.startLine !== currentLineNumber) {
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

const AnalysisAlertResult = ({ alert }: { alert: AnalysisAlert }) => {
  const code = alert.contextRegion.text
    .split('\n')
    .filter(line => line.replace('\n', '').length > 0);

  const startingLine = alert.contextRegion.startLine;

  return (
    <Container>
      <TitleContainer>
        <Link>{alert.filePath}</Link>
      </TitleContainer>
      <CodeContainer>
        {code.map((line, index) => (
          <div key={index}>
            <Message alert={alert} currentLineNumber={startingLine + index} />
            {/* TODO: Replace the following with actual code snippet component */}
            <Box display="flex" >
              <Box p={2} borderStyle="none" paddingTop="0.01em" paddingLeft="0.5em" paddingRight="0.5em">
                {startingLine + index}
              </Box>
              <Box flexGrow={1} p={2} borderStyle="none" paddingTop="0.01em" paddingLeft="0.5em" paddingRight="0.5em">
                {line}
              </Box>
            </Box>
          </div>
        ))}
      </CodeContainer>
    </Container>
  );
};

export default AnalysisAlertResult;
