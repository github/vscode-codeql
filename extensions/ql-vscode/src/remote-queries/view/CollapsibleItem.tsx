import * as React from 'react';
import styled from 'styled-components';
import { ChevronUpIcon, ChevronDownIcon } from '@primer/octicons-react';
import { useState } from 'react';

const Container = styled.div`
  display: block;
  vertical-align: middle;
`;

const TitleContainer = styled.span`
  display: inline-block;
`;

const Button = styled.button`
  display: inline-block;
  background-color: transparent;
  border: none;
  padding-left: 0;
  padding-right: 0.1em;
`;

const CollapsibleItem = ({
  title,
  children
}: {
  title: React.ReactNode;
  children: React.ReactNode
}) => {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <>
      <Container>
        <Button onClick={() => setExpanded(!isExpanded)}>
          {isExpanded
            ? <ChevronUpIcon size={16} />
            : <ChevronDownIcon size={16} />
          }
        </Button>
        <TitleContainer>{title}</TitleContainer>
      </Container>
      {isExpanded && children}
    </>
  );
};

export default CollapsibleItem;
