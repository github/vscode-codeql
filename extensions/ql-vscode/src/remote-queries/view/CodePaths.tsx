import { TriangleDownIcon, XCircleIcon } from '@primer/octicons-react';
import { ActionList, ActionMenu, Box, Button, Label, Link, Overlay } from '@primer/react';
import * as React from 'react';
import { useRef, useState } from 'react';
import styled from 'styled-components';
import { CodeFlow, AnalysisMessage, ResultSeverity } from '../shared/analysis-result';
import FileCodeSnippet from './FileCodeSnippet';
import SectionTitle from './SectionTitle';
import VerticalSpace from './VerticalSpace';

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
      <div key={`thread-flow-${index}`}>
        {index !== 0 && <VerticalSpace size={3} />}

        <Box display="flex" justifyContent="center" alignItems="center" width="42.5em">
          <Box flexGrow={1} p={0} border="none">
            <SectionTitle>Step {index + 1}</SectionTitle>
          </Box>
          {index === 0 &&
            <Box p={0} border="none">
              <Label>Source</Label>
            </Box>
          }
          {index === codeFlow.threadFlows.length - 1 &&
            <Box p={0} border="none">
              <Label>Sink</Label>
            </Box>
          }
        </Box>

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
  return <ActionMenu>
    <ActionMenu.Anchor>
      <Button variant="invisible" sx={{ fontWeight: 'normal', color: 'var(--vscode-editor-foreground);', padding: 0 }} >
        {getCodeFlowName(codeFlows[0])}
        <TriangleDownIcon size={16} />
      </Button>
    </ActionMenu.Anchor>
    <ActionMenu.Overlay sx={{ backgroundColor: 'var(--vscode-editor-background)' }}>
      <ActionList>
        {codeFlows.map((codeFlow, index) =>
          <ActionList.Item
            key={`codeflow-${index}'`}
            onSelect={(e: React.MouseEvent) => { setSelectedCodeFlow(codeFlow); }}>
            {getCodeFlowName(codeFlow)}
          </ActionList.Item>
        )}
      </ActionList>
    </ActionMenu.Overlay>
  </ActionMenu>;
};

const CodePaths = ({
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
    <Box ref={anchorRef}>
      <Link
        onClick={() => setIsOpen(true)}
        ref={linkRef}
        sx={{ cursor: 'pointer' }}>
        Show paths
      </Link>
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

            <Box display="flex" justifyContent="center" alignItems="center">
              <Box p={0} border="none">
                {codeFlows.length} paths available: {selectedCodeFlow.threadFlows.length} steps in
              </Box>
              <Box flexGrow={1} p={0} paddingLeft="0.2em" border="none">
                <Menu codeFlows={codeFlows} setSelectedCodeFlow={setSelectedCodeFlow} />
              </Box>
            </Box>

            <VerticalSpace size={2} />
            <CodePath
              codeFlow={selectedCodeFlow}
              severity={severity}
              message={message} />

            <VerticalSpace size={3} />

          </OverlayContainer>
        </Overlay>
      )}
    </Box>
  );
};

export default CodePaths;
