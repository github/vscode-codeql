import * as React from 'react';
import styled from 'styled-components';
import { AnalysisAlert, AnalysisRawResults } from '../../remote-queries/shared/analysis-result';
import AnalysisAlertResult from '../remote-queries/AnalysisAlertResult';
import RawResultsTable from '../remote-queries/RawResultsTable';
import { VariantAnalysisRepoStatus } from '../../remote-queries/shared/variant-analysis';
import { Alert } from '../common';

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const AlertContainer = styled.div`
  margin-top: 1em;
`;

const InterpretedResultsContainer = styled.ul`
  list-style-type: none;
  margin: 1em 0 0;
  padding: 0.5em 0 0 0;
`;

const InterpretedResultItem = styled.li`
  margin-bottom: 1em;
  background-color: var(--vscode-notifications-background);
`;

const RawResultsContainer = styled.div`
  display: block;
  margin-top: 0.5em;
`;

export type AnalyzedRepoItemContentProps = {
  status: VariantAnalysisRepoStatus;

  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
}

export const AnalyzedRepoItemContent = ({
  status,
  interpretedResults,
  rawResults,
}: AnalyzedRepoItemContentProps) => {
  return (
    <ContentContainer>
      {status === VariantAnalysisRepoStatus.Failed && <AlertContainer>
        <Alert
          type="error"
          title="Failed"
          message="The query failed to run on this repository."
        />
      </AlertContainer>}
      {status === VariantAnalysisRepoStatus.TimedOut && <AlertContainer>
        <Alert
          type="error"
          title="Timed out"
          message="The analysis ran out of time and we couldn't scan the repository."
        />
      </AlertContainer>}
      {status === VariantAnalysisRepoStatus.Canceled && <AlertContainer>
        <Alert
          type="error"
          title="Canceled"
          message="The variant analysis or this repository was canceled."
        />
      </AlertContainer>}
      {interpretedResults && (
        <InterpretedResultsContainer>
          {interpretedResults.map((r, i) =>
            <InterpretedResultItem key={i}>
              <AnalysisAlertResult alert={r} />
            </InterpretedResultItem>)}
        </InterpretedResultsContainer>
      )}
      {rawResults && (
        <RawResultsContainer>
          <RawResultsTable
            schema={rawResults.schema}
            results={rawResults.resultSet}
            fileLinkPrefix={rawResults.fileLinkPrefix}
            sourceLocationPrefix={rawResults.sourceLocationPrefix} />
        </RawResultsContainer>
      )}
    </ContentContainer>
  );
};
