import { Spinner } from '@primer/react';
import * as React from 'react';
import styled from 'styled-components';

const SpinnerContainer = styled.span`
  vertical-align: middle;

  svg {
    width: 0.8em;
    height: 0.8em;  
  }
`;

const DownloadSpinner = () => (
  <SpinnerContainer>
    <Spinner size="small" />
  </SpinnerContainer>
);

export default DownloadSpinner;
