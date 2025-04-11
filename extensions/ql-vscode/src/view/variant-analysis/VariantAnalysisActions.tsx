import { styled } from "styled-components";
import { VariantAnalysisStatus } from "../../variant-analysis/shared/variant-analysis";
import { VscodeButton } from "@vscode-elements/react-elements";

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
  hasFilteredRepositories?: boolean;
};

const Container = styled.div`
  margin-left: auto;
  display: flex;
  gap: 1em;
`;

const Button = styled(VscodeButton)`
  white-space: nowrap;
`;

const chooseText = ({
  hasSelectedRepositories,
  hasFilteredRepositories,
  normalText,
  selectedText,
  filteredText,
}: {
  hasSelectedRepositories?: boolean;
  hasFilteredRepositories?: boolean;
  normalText: string;
  selectedText: string;
  filteredText: string;
}) => {
  if (hasSelectedRepositories) {
    return selectedText;
  }
  if (hasFilteredRepositories) {
    return filteredText;
  }
  return normalText;
};

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
  hasFilteredRepositories,
}: VariantAnalysisActionsProps) => {
  return (
    <Container>
      {showResultActions && (
        <>
          <Button
            secondary
            onClick={onCopyRepositoryListClick}
            disabled={copyRepositoryListDisabled}
          >
            {chooseText({
              hasSelectedRepositories,
              hasFilteredRepositories,
              normalText: "Copy repository list",
              selectedText: "Copy selected repositories as a list",
              filteredText: "Copy filtered repositories as a list",
            })}
          </Button>
          <Button
            appearance="primary"
            onClick={onExportResultsClick}
            disabled={exportResultsDisabled}
          >
            {chooseText({
              hasSelectedRepositories,
              hasFilteredRepositories,
              normalText: "Export results",
              selectedText: "Export selected results",
              filteredText: "Export filtered results",
            })}
          </Button>
        </>
      )}
      {variantAnalysisStatus === VariantAnalysisStatus.InProgress && (
        <Button
          secondary
          onClick={onStopQueryClick}
          disabled={stopQueryDisabled}
        >
          Stop query
        </Button>
      )}
      {variantAnalysisStatus === VariantAnalysisStatus.Canceling && (
        <Button secondary disabled={true}>
          Stopping query
        </Button>
      )}
    </Container>
  );
};
