import { XCircleIcon } from '@primer/octicons-react';
import { Overlay } from '@primer/react';
import { VSCodeDropdown, VSCodeLink, VSCodeOption, VSCodeTag } from '@vscode/webview-ui-toolkit/react';
import * as React from 'react';
import { ChangeEvent, useRef, useState } from 'react';
import styled from 'styled-components';
import { CodeFlow, AnalysisMessage, ResultSeverity } from '../../../remote-queries/shared/analysis-result';
import { SectionTitle } from '../SectionTitle';
import { VerticalSpace } from '../VerticalSpace';
import { FileCodeSnippet } from '../FileCodeSnippet';

const StyledCloseButton = styled.button`
  position: absolute;
  top: 1em;
  right: 4em;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: none;
  &:focus-visible {
    outline: none
  }
`;

const OverlayContainer = styled.div`
  padding: 1em;
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
  <StyledCloseButton onClick={onClick} tabIndex={-1} >
    <XCircleIcon size={24} />
  </StyledCloseButton>
);

const CodePath = ({
  codeFlow,
  message,
  severity
}: {
  codeFlow: CodeFlow;
  message: AnalysisMessage;
  severity: ResultSeverity;
}) => {
  return <>
    {codeFlow.threadFlows.map((threadFlow, index) =>
      <div key={`thread-flow-${index}`} style={{ maxWidth: '55em' }}>
        {index !== 0 && <VerticalSpace size={3} />}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ flexGrow: 1, padding: 0, border: 'none' }}>
            <SectionTitle>Step {index + 1}</SectionTitle>
          </div>
          {index === 0 &&
            <div style={{ padding: 0, border: 'none' }}>
              <VSCodeTag>Source</VSCodeTag>
            </div>
          }
          {index === codeFlow.threadFlows.length - 1 &&
            <div style={{ padding: 0, border: 'none' }}>
              <VSCodeTag>Sink</VSCodeTag>
            </div>
          }
        </div>

        <VerticalSpace size={2} />
        <FileCodeSnippet
          fileLink={threadFlow.fileLink}
          codeSnippet={threadFlow.codeSnippet}
          highlightedRegion={threadFlow.highlightedRegion}
          severity={severity}
          message={index === codeFlow.threadFlows.length - 1 ? message : threadFlow.message} />
      </div>
    )}
  </>;
};

const getCodeFlowName = (codeFlow: CodeFlow) => {
  const filePath = codeFlow.threadFlows[codeFlow.threadFlows.length - 1].fileLink.filePath;
  return filePath.substring(filePath.lastIndexOf('/') + 1);
};

const Menu = ({
  codeFlows,
  setSelectedCodeFlow
}: {
  codeFlows: CodeFlow[],
  setSelectedCodeFlow: (value: React.SetStateAction<CodeFlow>) => void
}) => {
  return <VSCodeDropdown
    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
      const selectedOption = event.target;
      const selectedIndex = selectedOption.value as unknown as number;
      setSelectedCodeFlow(codeFlows[selectedIndex]);
    }}
  >
    {codeFlows.map((codeFlow, index) =>
      <VSCodeOption
        key={`codeflow-${index}'`}
        value={index}
      >
        {getCodeFlowName(codeFlow)}
      </VSCodeOption>
    )}
  </VSCodeDropdown>;
};

export const CodePaths = ({
  codeFlows,
  ruleDescription,
  message,
  severity
}: {
  codeFlows: CodeFlow[],
  ruleDescription: string,
  message: AnalysisMessage,
  severity: ResultSeverity
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCodeFlow, setSelectedCodeFlow] = useState(codeFlows[0]);

  const anchorRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const closeOverlay = () => setIsOpen(false);

  return (
    <div ref={anchorRef}>
      <VSCodeLink
        onClick={() => setIsOpen(true)}
        ref={linkRef}
        sx={{ cursor: 'pointer' }}>
        Show paths
      </VSCodeLink>
      {isOpen && (
        <Overlay
          returnFocusRef={linkRef}
          onEscape={closeOverlay}
          onClickOutside={closeOverlay}
          anchorSide="outside-top">
          <OverlayContainer>
            <CloseButton onClick={closeOverlay} />

            <SectionTitle>{ruleDescription}</SectionTitle>
            <VerticalSpace size={2} />

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ padding: 0, border: 0 }}>
                {codeFlows.length} paths available: {selectedCodeFlow.threadFlows.length} steps in
              </div>
              <div style={{ flexGrow: 1, padding: 0, paddingLeft: '0.2em', border: 'none' }}>
                <Menu codeFlows={codeFlows} setSelectedCodeFlow={setSelectedCodeFlow} />
              </div>
            </div>

            <VerticalSpace size={2} />
            <CodePath
              codeFlow={selectedCodeFlow}
              severity={severity}
              message={message} />

            <VerticalSpace size={3} />

          </OverlayContainer>
        </Overlay>
      )}
    </div>
  );
};
