import * as React from "react";
import styled from "styled-components";
import {
  AnalysisAlert,
  AnalysisRawResults,
} from "../../remote-queries/shared/analysis-result";
import RawResultsTable from "../remote-queries/RawResultsTable";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../remote-queries/shared/variant-analysis";
import { Alert } from "../common";
import { InterpretedResults } from "./InterpretedResults";

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const AlertContainer = styled.div`
  margin-top: 1em;
`;

const RawResultsContainer = styled.div`
  display: block;
  margin-top: 0.5em;
`;

export type AnalyzedRepoItemContentProps = {
  status?: VariantAnalysisRepoStatus;
  downloadStatus?: VariantAnalysisScannedRepositoryDownloadStatus;

  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;
};

export const AnalyzedRepoItemContent = ({
  status,
  downloadStatus,
  interpretedResults,
  rawResults,
}: AnalyzedRepoItemContentProps) => {
  return (
    <ContentContainer>
      {status === VariantAnalysisRepoStatus.Failed && (
        <AlertContainer>
          <Alert
            type="error"
            title="Failed"
            message="The query failed to run on this repository."
          />
        </AlertContainer>
      )}
      {status === VariantAnalysisRepoStatus.TimedOut && (
        <AlertContainer>
          <Alert
            type="error"
            title="Timed out"
            message="The analysis ran out of time and we couldn't scan the repository."
          />
        </AlertContainer>
      )}
      {status === VariantAnalysisRepoStatus.Canceled && (
        <AlertContainer>
          <Alert
            type="error"
            title="Canceled"
            message="The variant analysis for this repository was canceled."
          />
        </AlertContainer>
      )}
      {downloadStatus ===
        VariantAnalysisScannedRepositoryDownloadStatus.Failed && (
        <AlertContainer>
          <Alert
            type="error"
            title="Download failed"
            message="The query was successful on this repository, but the extension failed to download the results for this repository."
          />
        </AlertContainer>
      )}
      {interpretedResults && (
        <InterpretedResults interpretedResults={interpretedResults} />
      )}
      {rawResults && (
        <RawResultsContainer>
          <RawResultsTable
            schema={rawResults.schema}
            results={rawResults.resultSet}
            fileLinkPrefix={rawResults.fileLinkPrefix}
            sourceLocationPrefix={rawResults.sourceLocationPrefix}
          />
        </RawResultsContainer>
      )}
    </ContentContainer>
  );
};
