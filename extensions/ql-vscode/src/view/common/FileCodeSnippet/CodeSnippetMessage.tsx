import { styled } from "styled-components";
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";

import type {
  AnalysisMessage,
  ResultSeverity,
} from "../../../variant-analysis/shared/analysis-result";
import { createRemoteFileRef } from "../../../common/location-link-utils";
import { VerticalSpace } from "../VerticalSpace";
import { sendTelemetry } from "../telemetry";

const getSeverityColor = (severity: ResultSeverity) => {
  switch (severity) {
    case "Recommendation":
      return "var(--vscode-editorInfo-foreground)";
    case "Warning":
      return "var(--vscode-editorWarning-foreground)";
    case "Error":
      return "var(--vscode-editorError-foreground)";
  }
};

const MessageText = styled.div`
  font-size: small;
  padding-left: 0.5em;
`;

type CodeSnippetMessageContainerProps = {
  $severity: ResultSeverity;
};

const CodeSnippetMessageContainer = styled.div<CodeSnippetMessageContainerProps>`
  border-color: var(--vscode-editor-snippetFinalTabstopHighlightBorder);
  border-width: 0.1em;
  border-style: solid;
  border-left-color: ${(props) => getSeverityColor(props.$severity)};
  border-left-width: 0.3em;
  padding-top: 1em;
  padding-bottom: 1em;
`;

const LocationLink = styled(VSCodeLink)`
  font-family: var(--vscode-editor-font-family);
`;

type CodeSnippetMessageProps = {
  message: AnalysisMessage;
  severity: ResultSeverity;
  children: React.ReactNode;
};

const sendAlertMessageLinkTelemetry = () => sendTelemetry("alert-message-link");

export const CodeSnippetMessage = ({
  message,
  severity,
  children,
}: CodeSnippetMessageProps) => {
  return (
    <CodeSnippetMessageContainer $severity={severity}>
      <MessageText>
        {message.tokens.map((token, index) => {
          switch (token.t) {
            case "text":
              return <span key={index}>{token.text}</span>;
            case "location":
              return (
                <LocationLink
                  key={index}
                  onClick={sendAlertMessageLinkTelemetry}
                  href={createRemoteFileRef(
                    token.location.fileLink,
                    token.location.highlightedRegion?.startLine,
                    token.location.highlightedRegion?.endLine,
                    token.location.highlightedRegion?.startColumn,
                    token.location.highlightedRegion?.endColumn,
                  )}
                >
                  {token.text}
                </LocationLink>
              );
            default:
              return <></>;
          }
        })}
        {children && (
          <>
            <VerticalSpace $size={2} />
            {children}
          </>
        )}
      </MessageText>
    </CodeSnippetMessageContainer>
  );
};
