import * as React from "react";
import styled from "styled-components";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { VariantAnalysisStatus } from "../../remote-queries/shared/variant-analysis";

type Props = {
  variantAnalysisStatus: VariantAnalysisStatus;

  onStopQueryClick: () => void;
  stopQueryDisabled?: boolean;

  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;
};

const Container = styled.div`
  margin-left: auto;
  display: flex;
  gap: 1em;
`;

const Button = styled(VSCodeButton)`
  white-space: nowrap;
`;

export const VariantAnalysisActions = ({
  variantAnalysisStatus,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick,
  stopQueryDisabled,
}: Props) => {
  return (
    <Container>
      {variantAnalysisStatus === VariantAnalysisStatus.InProgress && (
        <Button
          appearance="secondary"
          onClick={onStopQueryClick}
          disabled={stopQueryDisabled}
        >
          Stop query
        </Button>
      )}
      {variantAnalysisStatus === VariantAnalysisStatus.Succeeded && (
        <>
          <Button appearance="secondary" onClick={onCopyRepositoryListClick}>
            Copy repository list
          </Button>
          <Button appearance="primary" onClick={onExportResultsClick}>
            Export results
          </Button>
        </>
      )}
    </Container>
  );
};
