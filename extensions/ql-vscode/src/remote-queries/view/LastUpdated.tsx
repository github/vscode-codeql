import * as React from 'react';
import { RepoPushIcon } from '@primer/octicons-react';
import styled from 'styled-components';

import { humanizeDuration } from '../../pure/time';

const IconContainer = styled.span`
  flex-grow: 0;
  text-align: right;
  margin-right: 0;
`;

const Duration = styled.span`
  text-align: left;
  width: 8em;
  margin-left: 0.5em;
`;

type Props = { lastUpdated?: number };

const LastUpdated = ({ lastUpdated }: Props) => (
  Number.isFinite(lastUpdated) ? (
    <>
      <IconContainer>
        <RepoPushIcon size={16} />
      </IconContainer>
      <Duration>
        {humanizeDuration(lastUpdated && -lastUpdated)}
      </Duration>
    </>
  ) : (
    <></>
  )
);

export default LastUpdated;
