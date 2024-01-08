import { styled } from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import type {
  AnalysisMessage,
  CodeSnippet,
  FileLink,
  HighlightedRegion,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { createRemoteFileRef } from "../../../common/location-link-utils";
import { CodeSnippetMessage } from "./CodeSnippetMessage";
import { CodeSnippetLine } from "./CodeSnippetLine";
import { sendTelemetry } from "../telemetry";

const borderColor = "var(--vscode-editor-snippetFinalTabstopHighlightBorder)";

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

type Props = {
  fileLink: FileLink;
  codeSnippet?: CodeSnippet;
  highlightedRegion?: HighlightedRegion;
  severity?: ResultSeverity;
  message?: AnalysisMessage;
  messageChildren?: React.ReactNode;
};

const sendCodeSnippetTitleLinkTelemetry = () =>
  sendTelemetry("file-code-snippet-title-link");

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
    highlightedRegion?.endLine || endingLine,
    highlightedRegion?.startColumn,
    highlightedRegion?.endColumn,
  );

  if (!codeSnippet) {
    return (
      <Container>
        <TitleContainer>
          <VSCodeLink
            onClick={sendCodeSnippetTitleLinkTelemetry}
            href={titleFileUri}
          >
            {fileLink.filePath}
          </VSCodeLink>
        </TitleContainer>
        {message && severity && (
          <CodeSnippetMessage message={message} severity={severity}>
            {messageChildren}
          </CodeSnippetMessage>
        )}
      </Container>
    );
  }

  const code = codeSnippet.text.split("\n");

  return (
    <Container>
      <TitleContainer>
        <VSCodeLink
          onClick={sendCodeSnippetTitleLinkTelemetry}
          href={titleFileUri}
        >
          {fileLink.filePath}
        </VSCodeLink>
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
