import * as React from 'react';
import styled from 'styled-components';

const FirstRow = styled.div`
  font-size: x-large;
  font-weight: 600;
  text-align: center;
  margin-bottom: 0.5em;
`;

const SecondRow = styled.div`
  text-align: center;
  color: var(--vscode-descriptionForeground);
`;

export const VariantAnalysisLoading = () => {
  return (
    <div>
      <FirstRow>We are getting everything ready</FirstRow>
      <SecondRow>Results will appear here shortly</SecondRow>
    </div>
  );
};
