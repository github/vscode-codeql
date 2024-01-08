import { styled } from "styled-components";

import type {
  AnalysisMessage,
  HighlightedRegion,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { CodeSnippetCode } from "./CodeSnippetCode";
import { CodeSnippetMessage } from "./CodeSnippetMessage";

const MessageContainer = styled.div`
  padding-top: 0.5em;
  padding-bottom: 0.5em;
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

type CodeSnippetLineProps = {
  line: string;
  lineIndex: number;
  startingLineIndex: number;
  highlightedRegion?: HighlightedRegion;
  severity?: ResultSeverity;
  message?: AnalysisMessage;
  messageChildren?: React.ReactNode;
};

export const CodeSnippetLine = ({
  line,
  lineIndex,
  startingLineIndex,
  highlightedRegion,
  severity,
  message,
  messageChildren,
}: CodeSnippetLineProps) => {
  const shouldShowMessage =
    message &&
    severity &&
    highlightedRegion &&
    highlightedRegion.endLine === startingLineIndex + lineIndex;

  return (
    <div>
      <LineContainer>
        <LineNumberContainer>
          {startingLineIndex + lineIndex}
        </LineNumberContainer>
        <CodeSnippetLineCodeContainer>
          <CodeSnippetCode
            line={line}
            lineNumber={startingLineIndex + lineIndex}
            highlightedRegion={highlightedRegion}
          />
        </CodeSnippetLineCodeContainer>
      </LineContainer>
      {shouldShowMessage && (
        <MessageContainer>
          <CodeSnippetMessage message={message} severity={severity}>
            {messageChildren}
          </CodeSnippetMessage>
        </MessageContainer>
      )}
    </div>
  );
};
