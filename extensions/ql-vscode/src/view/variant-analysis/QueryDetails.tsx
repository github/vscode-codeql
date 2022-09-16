import * as React from 'react';
import styled from 'styled-components';
import ViewTitle from '../remote-queries/ViewTitle';
import { LinkIconButton } from './LinkIconButton';

type Props = {
  queryName: string;
  queryFileName: string;

  onOpenQueryFileClick: () => void;
  onViewQueryTextClick: () => void;
};

const Container = styled.div`
  max-width: 100%;
`;

const QueryActions = styled.div`
  display: flex;
  gap: 1em;
`;

export const QueryDetails = ({
  queryName,
  queryFileName,
  onOpenQueryFileClick,
  onViewQueryTextClick,
}: Props) => {
  return (
    <Container>
      <ViewTitle>{queryName}</ViewTitle>
      <QueryActions>
        <LinkIconButton onClick={onOpenQueryFileClick}>
          <span slot="start" className="codicon codicon-file-code"></span>
          {queryFileName}
        </LinkIconButton>
        <LinkIconButton onClick={onViewQueryTextClick}>
          <span slot="start" className="codicon codicon-code"></span>
          View query
        </LinkIconButton>
      </QueryActions>
    </Container>
  );
};
