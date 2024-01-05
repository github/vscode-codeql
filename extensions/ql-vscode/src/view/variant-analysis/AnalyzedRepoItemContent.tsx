import { styled } from "styled-components";
import type {
  AnalysisAlert,
  AnalysisRawResults,
} from "../../variant-analysis/shared/analysis-result";
import AnalysisAlertResult from "./AnalysisAlertResult";
import RawResultsTable from "./RawResultsTable";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { Alert } from "../common";
import { ResultFormat } from "../../variant-analysis/shared/variant-analysis-result-format";

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

function chooseResultFormat(
  interpretedResults: AnalysisAlert[] | undefined,
  rawResults: AnalysisRawResults | undefined,
  resultFormat: ResultFormat,
): ResultFormat | undefined {
  if (interpretedResults && resultFormat === ResultFormat.Alerts) {
    return ResultFormat.Alerts;
  } else if (rawResults) {
    return ResultFormat.RawResults;
  } else {
    return undefined;
  }
}

export type AnalyzedRepoItemContentProps = {
  status?: VariantAnalysisRepoStatus;
  downloadStatus?: VariantAnalysisScannedRepositoryDownloadStatus;

  interpretedResults?: AnalysisAlert[];
  rawResults?: AnalysisRawResults;

  resultFormat: ResultFormat;
};

export const AnalyzedRepoItemContent = ({
  status,
  downloadStatus,
  interpretedResults,
  rawResults,
  resultFormat,
}: AnalyzedRepoItemContentProps) => {
  const chosenResultFormat = chooseResultFormat(
    interpretedResults,
    rawResults,
    resultFormat,
  );
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
      {interpretedResults && chosenResultFormat === ResultFormat.Alerts && (
        <InterpretedResultsContainer>
          {interpretedResults.map((r, i) => (
            <InterpretedResultItem key={i}>
              <AnalysisAlertResult alert={r} />
            </InterpretedResultItem>
          ))}
        </InterpretedResultsContainer>
      )}
      {rawResults && chosenResultFormat === ResultFormat.RawResults && (
        <RawResultsContainer>
          <RawResultsTable
            resultSet={rawResults.resultSet}
            fileLinkPrefix={rawResults.fileLinkPrefix}
            sourceLocationPrefix={rawResults.sourceLocationPrefix}
          />
        </RawResultsContainer>
      )}
    </ContentContainer>
  );
};
