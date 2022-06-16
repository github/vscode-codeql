import * as React from 'react';
import styled from 'styled-components';
import { CodeSnippet, FileLink, HighlightedRegion, AnalysisMessage, ResultSeverity } from '../shared/analysis-result';
import VerticalSpace from './VerticalSpace';
import { createRemoteFileRef } from '../../pure/location-link-utils';
import { parseHighlightedLine, shouldHighlightLine } from '../../pure/sarif-utils';
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';

const borderColor = 'var(--vscode-editor-snippetFinalTabstopHighlightBorder)';
const warningColor = '#966C23';
const highlightColor = 'var(--vscode-editor-findMatchHighlightBackground)';

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

const replaceSpaceAndTabChar = (text: string) => text.replaceAll(' ', '\u00a0').replaceAll('\t', '\u00a0\u00a0\u00a0\u00a0');

const Container = styled.div`
  font-family: var(--vscode-editor-font-family);
  font-size: small;
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
  font-size: small;
  padding-left: 0.5em;
`;

const MessageContainer = styled.div`
  padding-top: 0.5em;
  padding-bottom: 0.5em;
`;

const PlainLine = ({ text }: { text: string }) => {
  return <span>{replaceSpaceAndTabChar(text)}</span>;
};

const HighlightedLine = ({ text }: { text: string }) => {
  return <span style={{ backgroundColor: highlightColor }}>{replaceSpaceAndTabChar(text)}</span>;
};

const Message = ({
  message,
  currentLineNumber,
  highlightedRegion,
  borderLeftColor,
  children
}: {
  message: AnalysisMessage,
  currentLineNumber: number,
  highlightedRegion?: HighlightedRegion,
  borderLeftColor: string,
  children: React.ReactNode
}) => {
  if (!highlightedRegion || highlightedRegion.endLine !== currentLineNumber) {
    return <></>;
  }

  return <MessageContainer>
    <div style={{
      borderColor: borderColor,
      borderWidth: '0.1em',
      borderStyle: 'solid',
      borderLeftColor: borderLeftColor,
      borderLeftWidth: '0.3em',
      paddingTop: '1em',
      paddingBottom: '1em'
    }}>
      <MessageText>
        {message.tokens.map((token, index) => {
          switch (token.t) {
            case 'text':
              return <span key={`token-${index}`}>{token.text}</span>;
            case 'location':
              return <VSCodeLink
                style={{ fontFamily: 'var(--vscode-editor-font-family)' }}
                key={`token-${index}`}
                href={createRemoteFileRef(
                  token.location.fileLink,
                  token.location.highlightedRegion?.startLine,
                  token.location.highlightedRegion?.endLine)}>
                {token.text}
              </VSCodeLink>;
            default:
              return <></>;
          }
        })}
        {children && <>
          <VerticalSpace size={2} />
          {children}
        </>
        }
      </MessageText>
    </div>
  </MessageContainer>;
};

const CodeLine = ({
  line,
  lineNumber,
  highlightedRegion
}: {
  line: string,
  lineNumber: number,
  highlightedRegion?: HighlightedRegion
}) => {
  if (!highlightedRegion || !shouldHighlightLine(lineNumber, highlightedRegion)) {
    return <PlainLine text={line} />;
  }

  const partiallyHighlightedLine = parseHighlightedLine(line, lineNumber, highlightedRegion);

  return (
    <>
      <PlainLine text={partiallyHighlightedLine.plainSection1} />
      <HighlightedLine text={partiallyHighlightedLine.highlightedSection} />
      <PlainLine text={partiallyHighlightedLine.plainSection2} />
    </>
  );
};

const FileCodeSnippet = ({
  fileLink,
  codeSnippet,
  highlightedRegion,
  severity,
  message,
  messageChildren,
}: {
  fileLink: FileLink,
  codeSnippet?: CodeSnippet,
  highlightedRegion?: HighlightedRegion,
  severity?: ResultSeverity,
  message?: AnalysisMessage,
  messageChildren?: React.ReactNode,
}) => {

  const startingLine = codeSnippet?.startLine || 0;
  const endingLine = codeSnippet?.endLine || 0;

  const titleFileUri = createRemoteFileRef(
    fileLink,
    highlightedRegion?.startLine || startingLine,
    highlightedRegion?.endLine || endingLine);

  if (!codeSnippet) {
    return (
      <Container>
        <TitleContainer>
          <VSCodeLink href={titleFileUri}>{fileLink.filePath}</VSCodeLink>
        </TitleContainer>
      </Container>
    );
  }

  const code = codeSnippet.text.split('\n');

  return (
    <Container>
      <TitleContainer>
        <VSCodeLink href={titleFileUri}>{fileLink.filePath}</VSCodeLink>
      </TitleContainer>
      <CodeContainer>
        {code.map((line, index) => (
          <div key={index}>
            <div style={{ display: 'flex' }} >
              <div style={{
                borderStyle: 'none',
                paddingTop: '0.01em',
                paddingLeft: '0.5em',
                paddingRight: '0.5em',
                paddingBottom: '0.2em'
              }}>
                {startingLine + index}
              </div>
              <div style={{
                flexGrow: 1,
                borderStyle: 'none',
                paddingTop: '0.01em',
                paddingLeft: '1.5em',
                paddingRight: '0.5em',
                paddingBottom: '0.2em',
                wordBreak: 'break-word'
              }}>
                <CodeLine
                  line={line}
                  lineNumber={startingLine + index}
                  highlightedRegion={highlightedRegion} />
              </div>
            </div>
            {message && severity && <Message
              message={message}
              currentLineNumber={startingLine + index}
              highlightedRegion={highlightedRegion}
              borderLeftColor={getSeverityColor(severity)}>
              {messageChildren}
            </Message>}
          </div>
        ))}
      </CodeContainer>
    </Container>
  );
};

export default FileCodeSnippet;
