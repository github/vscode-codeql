import * as React from 'react';
import styled from 'styled-components';
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import {
  AnalysisMessage,
  CodeSnippet,
  FileLink,
  HighlightedRegion,
  ResultSeverity
} from '../../remote-queries/shared/analysis-result';
import { createRemoteFileRef } from '../../pure/location-link-utils';
import { parseHighlightedLine, shouldHighlightLine } from '../../pure/sarif-utils';
import { VerticalSpace } from '../common';

const borderColor = 'var(--vscode-editor-snippetFinalTabstopHighlightBorder)';

const getSeverityColor = (severity: ResultSeverity) => {
  switch (severity) {
    case 'Recommendation':
      return 'var(--vscode-editorInfo-foreground)';
    case 'Warning':
      return 'var(--vscode-editorWarning-foreground)';
    case 'Error':
      return 'var(--vscode-editorError-foreground)';
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

const HighlightedSpan = styled.span`
  background-color: var(--vscode-editor-findMatchHighlightBackground);
`;

const LineContainer = styled.div`
  display: flex;
`;

const LineNumberContainer = styled.div`
  border-style: none;
  padding: 0.01em 0.5em 0.2em;
`;

const CodeSnippetLineCodeContainer = styled.div`
  flex-grow: 1;
  border-style: none;
  padding: 0.01em 0.5em 0.2em 1.5em;
  word-break: break-word;
`;

type CodeSnippetMessageContainerProps = {
  severity: ResultSeverity;
};

const CodeSnippetMessageContainer = styled.div<CodeSnippetMessageContainerProps>`
  border-color: var(--vscode-editor-snippetFinalTabstopHighlightBorder);
  border-width: 0.1em;
  border-style: solid;
  border-left-color: ${props => getSeverityColor(props.severity)};
  border-left-width: 0.3em;
  padding-top: 1em;
  padding-bottom: 1em;
`;

const LocationLink = styled(VSCodeLink)`
  font-family: var(--vscode-editor-font-family)
`;

const PlainCode = ({ text }: { text: string }) => {
  return <span>{replaceSpaceAndTabChar(text)}</span>;
};

const HighlightedCode = ({ text }: { text: string }) => {
  return <HighlightedSpan>{replaceSpaceAndTabChar(text)}</HighlightedSpan>;
};


type CodeSnippetMessageProps = {
  message: AnalysisMessage,
  severity: ResultSeverity,
  children: React.ReactNode
};

const CodeSnippetMessage = ({
  message,
  severity,
  children
}: CodeSnippetMessageProps) => {
  return (
    <CodeSnippetMessageContainer
      severity={severity}
    >
      <MessageText>
        {message.tokens.map((token, index) => {
          switch (token.t) {
            case 'text':
              return <span key={index}>{token.text}</span>;
            case 'location':
              return (
                <LocationLink
                  key={index}
                  href={
                    createRemoteFileRef(
                      token.location.fileLink,
                      token.location.highlightedRegion?.startLine,
                      token.location.highlightedRegion?.endLine
                    )
                  }
                >
                  {token.text}
                </LocationLink>
              );
            default:
              return <></>;
          }
        })}
        {
          children && (
            <>
              <VerticalSpace size={2} />
              {children}
            </>
          )
        }
      </MessageText>
    </CodeSnippetMessageContainer>
  );
};

const CodeSnippetCode = ({
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

type CodeSnippetLineProps = {
  line: string,
  lineIndex: number,
  startingLineIndex: number,
  highlightedRegion?: HighlightedRegion,
  severity?: ResultSeverity,
  message?: AnalysisMessage,
  messageChildren?: React.ReactNode,
};

const CodeSnippetLine = ({
  line,
  lineIndex,
  startingLineIndex,
  highlightedRegion,
  severity,
  message,
  messageChildren
}: CodeSnippetLineProps) => {
  const shouldShowMessage = message &&
    severity &&
    highlightedRegion &&
    highlightedRegion.endLine == startingLineIndex + lineIndex;

  return (
    <div>
      <LineContainer>
        <LineNumberContainer>{startingLineIndex + lineIndex}</LineNumberContainer>
        <CodeSnippetLineCodeContainer>
          <CodeSnippetCode
            line={line}
            lineNumber={startingLineIndex + lineIndex}
            highlightedRegion={highlightedRegion}
          />
        </CodeSnippetLineCodeContainer>
      </LineContainer>
      {shouldShowMessage &&
        <MessageContainer>
          <CodeSnippetMessage
            message={message}
            severity={severity}
          >
            {messageChildren}
          </CodeSnippetMessage>
        </MessageContainer>
      }
    </div>
  );
};

type Props = {
  fileLink: FileLink,
  codeSnippet?: CodeSnippet,
  highlightedRegion?: HighlightedRegion,
  severity?: ResultSeverity,
  message?: AnalysisMessage,
  messageChildren?: React.ReactNode,
};

export const FileCodeSnippet = ({
  fileLink,
  codeSnippet,
  highlightedRegion,
  severity,
  message,
  messageChildren,
}: Props) => {

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
        {message && severity &&
          <CodeSnippetMessage
            message={message}
            severity={severity}
          >
            {messageChildren}
          </CodeSnippetMessage>}
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
          <CodeSnippetLine
            key={index}
            line={line}
            lineIndex={index}
            startingLineIndex={startingLine}
            highlightedRegion={highlightedRegion}
            severity={severity}
            message={message}
            messageChildren={messageChildren}
          />
        ))}
      </CodeContainer>
    </Container>
  );
};
