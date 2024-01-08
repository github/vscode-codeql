import { styled } from "styled-components";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";

import type {
  AnalysisMessage,
  ResultSeverity,
  ThreadFlow,
} from "../../../variant-analysis/shared/analysis-result";
import { SectionTitle } from "../SectionTitle";
import { FileCodeSnippet } from "../FileCodeSnippet";

const Container = styled.div`
  max-width: 55em;
  margin-bottom: 1.5em;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1em;
`;

const TitleContainer = styled.div`
  flex-grow: 1;
  padding: 0;
  border: none;
`;

const TagContainer = styled.div`
  padding: 0;
  border: none;
`;

type ThreadPathProps = {
  threadFlow: ThreadFlow;
  step: number;
  message: AnalysisMessage;
  severity: ResultSeverity;
  isSource?: boolean;
  isSink?: boolean;
};

export const ThreadPath = ({
  threadFlow,
  step,
  message,
  severity,
  isSource,
  isSink,
}: ThreadPathProps) => (
  <Container>
    <HeaderContainer>
      <TitleContainer>
        <SectionTitle>Step {step}</SectionTitle>
      </TitleContainer>
      {isSource && (
        <TagContainer>
          <VSCodeTag>Source</VSCodeTag>
        </TagContainer>
      )}
      {isSink && (
        <TagContainer>
          <VSCodeTag>Sink</VSCodeTag>
        </TagContainer>
      )}
    </HeaderContainer>

    <FileCodeSnippet
      fileLink={threadFlow.fileLink}
      codeSnippet={threadFlow.codeSnippet}
      highlightedRegion={threadFlow.highlightedRegion}
      severity={severity}
      message={isSink ? message : threadFlow.message}
    />
  </Container>
);
