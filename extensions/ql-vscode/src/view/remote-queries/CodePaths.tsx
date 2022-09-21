import * as React from 'react';
import { ChangeEvent, SetStateAction, useCallback, useRef, useState } from 'react';
import styled from 'styled-components';
import { VSCodeDropdown, VSCodeLink, VSCodeOption, VSCodeTag } from '@vscode/webview-ui-toolkit/react';

import { Overlay } from '@primer/react';

import { AnalysisMessage, CodeFlow, ResultSeverity, ThreadFlow } from '../../remote-queries/shared/analysis-result';
import { SectionTitle, VerticalSpace } from '../common';
import { FileCodeSnippet } from './FileCodeSnippet';

const StyledCloseButton = styled.button`
  position: absolute;
  top: 1em;
  right: 4em;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: none
  }
`;

const OverlayContainer = styled.div`
  height: 100%;
  width: 100%;
  padding: 2em;
  position: fixed;
  top: 0;
  left: 0;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  overflow-y: scroll;
`;

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <StyledCloseButton onClick={onClick} tabIndex={-1}>
    <span className="codicon codicon-chrome-close" />
  </StyledCloseButton>
);

const PathsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const PathDetailsContainer = styled.div`
  padding: 0;
  border: 0;
`;

const PathDropdownContainer = styled.div`
  flex-grow: 1;
  padding: 0 0 0 0.2em;
  border: none;
`;

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

const ShowPathsLink = styled(VSCodeLink)`
  cursor: pointer;
`;

type ThreadPathProps = {
  threadFlow: ThreadFlow;
  step: number;
  message: AnalysisMessage;
  severity: ResultSeverity;
  isSource?: boolean;
  isSink?: boolean;
}

const ThreadPath = ({
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
      {isSource &&
        <TagContainer>
          <VSCodeTag>Source</VSCodeTag>
        </TagContainer>
      }
      {isSink &&
        <TagContainer>
          <VSCodeTag>Sink</VSCodeTag>
        </TagContainer>
      }
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

type CodePathProps = {
  codeFlow: CodeFlow;
  message: AnalysisMessage;
  severity: ResultSeverity;
}

const CodePath = ({
  codeFlow,
  message,
  severity
}: CodePathProps) => (
  <>
    {codeFlow.threadFlows.map((threadFlow, index) =>
      <ThreadPath
        key={index}
        threadFlow={threadFlow}
        step={index + 1}
        message={message}
        severity={severity}
        isSource={index === 0}
        isSink={index === codeFlow.threadFlows.length - 1}
      />
    )}
  </>
);

const getCodeFlowName = (codeFlow: CodeFlow) => {
  const filePath = codeFlow.threadFlows[codeFlow.threadFlows.length - 1].fileLink.filePath;
  return filePath.substring(filePath.lastIndexOf('/') + 1);
};

type CodeFlowsDropdownProps = {
  codeFlows: CodeFlow[];
  setSelectedCodeFlow: (value: SetStateAction<CodeFlow>) => void;
}

const CodeFlowsDropdown = ({
  codeFlows,
  setSelectedCodeFlow
}: CodeFlowsDropdownProps) => {
  const handleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = e.target;
    const selectedIndex = selectedOption.value as unknown as number;
    setSelectedCodeFlow(codeFlows[selectedIndex]);
  }, [setSelectedCodeFlow, codeFlows]);

  return (
    <VSCodeDropdown onChange={handleChange}>
      {codeFlows.map((codeFlow, index) =>
        <VSCodeOption
          key={index}
          value={index}
        >
          {getCodeFlowName(codeFlow)}
        </VSCodeOption>
      )}
    </VSCodeDropdown>
  );
};

type CodePathsOverlayProps = {
  codeFlows: CodeFlow[];
  ruleDescription: string;
  message: AnalysisMessage;
  severity: ResultSeverity;
  onClose: () => void;
}

const CodePathsOverlay = ({
  codeFlows,
  ruleDescription,
  message,
  severity,
  onClose,
}: CodePathsOverlayProps) => {
  const [selectedCodeFlow, setSelectedCodeFlow] = useState(codeFlows[0]);

  return (
    <OverlayContainer>
      <CloseButton onClick={onClose} />

      <SectionTitle>{ruleDescription}</SectionTitle>
      <VerticalSpace size={2} />

      <PathsContainer>
        <PathDetailsContainer>
          {codeFlows.length} paths available: {selectedCodeFlow.threadFlows.length} steps in
        </PathDetailsContainer>
        <PathDropdownContainer>
          <CodeFlowsDropdown codeFlows={codeFlows} setSelectedCodeFlow={setSelectedCodeFlow} />
        </PathDropdownContainer>
      </PathsContainer>

      <VerticalSpace size={2} />
      <CodePath
        codeFlow={selectedCodeFlow}
        severity={severity}
        message={message}
      />
      <VerticalSpace size={3} />
    </OverlayContainer>
  );
};

type Props = {
  codeFlows: CodeFlow[],
  ruleDescription: string,
  message: AnalysisMessage,
  severity: ResultSeverity
};

export const CodePaths = ({
  codeFlows,
  ruleDescription,
  message,
  severity
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const linkRef = useRef<HTMLAnchorElement>(null);

  const closeOverlay = () => setIsOpen(false);

  return (
    <>
      <ShowPathsLink
        onClick={() => setIsOpen(true)}
        ref={linkRef}
      >
        Show paths
      </ShowPathsLink>
      {isOpen && (
        <Overlay
          returnFocusRef={linkRef}
          onEscape={closeOverlay}
          onClickOutside={closeOverlay}
          anchorSide="outside-top"
        >
          <CodePathsOverlay
            codeFlows={codeFlows}
            ruleDescription={ruleDescription}
            message={message}
            severity={severity}
            onClose={closeOverlay}
          />
        </Overlay>
      )}
    </>
  );
};
