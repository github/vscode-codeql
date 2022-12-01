import * as React from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { XCircleIcon } from "@primer/octicons-react";

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  opacity: 1;
  background-color: var(--vscode-editor-background);
  z-index: 5000;
  padding-top: 1em;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1em;
  right: 1em;
  background-color: var(--vscode-editor-background);
  border: none;
`;

const FullScreenModal = ({
  setOpen,
  containerElementId,
  children,
}: {
  setOpen: (open: boolean) => void;
  containerElementId: string;
  children: React.ReactNode;
}) => {
  const containerElement = document.getElementById(containerElementId);
  if (!containerElement) {
    throw Error(`Could not find container element. Id: ${containerElementId}`);
  }

  return createPortal(
    <>
      <Container>
        <CloseButton onClick={() => setOpen(false)}>
          <XCircleIcon size={24} />
        </CloseButton>
        {children}
      </Container>
    </>,
    containerElement,
  );
};

export default FullScreenModal;
