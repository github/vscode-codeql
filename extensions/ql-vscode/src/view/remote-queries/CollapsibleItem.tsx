import * as React from "react";
import styled from "styled-components";
import { ChevronDownIcon, ChevronRightIcon } from "@primer/octicons-react";
import { useState } from "react";

const Container = styled.div`
  display: block;
  vertical-align: middle;
  cursor: pointer;
`;

const TitleContainer = styled.span`
  display: inline-block;
`;

const Button = styled.button`
  display: inline-block;
  background-color: transparent;
  color: var(--vscode-editor-foreground);
  border: none;
  padding-left: 0;
  padding-right: 0.1em;
`;

const CollapsibleItem = ({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) => {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <>
      <Container onClick={() => setExpanded(!isExpanded)}>
        <Button>
          {isExpanded ? (
            <ChevronDownIcon size={16} />
          ) : (
            <ChevronRightIcon size={16} />
          )}
        </Button>
        <TitleContainer>{title}</TitleContainer>
      </Container>
      {isExpanded && children}
    </>
  );
};

export default CollapsibleItem;
