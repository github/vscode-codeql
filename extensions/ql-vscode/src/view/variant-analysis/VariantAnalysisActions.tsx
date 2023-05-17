import * as React from "react";
import styled from "styled-components";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";

export type VariantAnalysisActionsProps = {
  variantAnalysisStatus: VariantAnalysisStatus;

  onStopQueryClick: () => void;
  stopQueryDisabled?: boolean;

  showResultActions?: boolean;
  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;
  copyRepositoryListDisabled?: boolean;
  exportResultsDisabled?: boolean;

  hasSelectedRepositories?: boolean;
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
  stopQueryDisabled,
  showResultActions,
  onCopyRepositoryListClick,
  onExportResultsClick,
  copyRepositoryListDisabled,
  exportResultsDisabled,
  hasSelectedRepositories,
}: VariantAnalysisActionsProps) => {
  return (
    <Container>
      {showResultActions && (
        <>
          <Button
            appearance="secondary"
            onClick={onCopyRepositoryListClick}
            disabled={copyRepositoryListDisabled}
          >
            {hasSelectedRepositories
              ? "Copy selected repositories as a list"
              : "Copy repository list"}
          </Button>
          <Button
            appearance="primary"
            onClick={onExportResultsClick}
            disabled={exportResultsDisabled}
          >
            {hasSelectedRepositories
              ? "Export selected results"
              : "Export results"}
          </Button>
        </>
      )}
      {variantAnalysisStatus === VariantAnalysisStatus.InProgress && (
        <Button
          appearance="secondary"
          onClick={onStopQueryClick}
          disabled={stopQueryDisabled}
        >
          Stop query
        </Button>
      )}
    </Container>
  );
};
