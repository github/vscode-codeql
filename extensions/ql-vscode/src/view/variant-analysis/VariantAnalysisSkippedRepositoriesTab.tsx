import { useMemo } from "react";
import { styled } from "styled-components";
import type { VariantAnalysisSkippedRepositoryGroup } from "../../variant-analysis/shared/variant-analysis";
import { Alert } from "../common";
import { RepoRow } from "./RepoRow";
import type { RepositoriesFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import {
  compareRepository,
  matchesFilter,
} from "../../variant-analysis/shared/variant-analysis-filter-sort";

export type VariantAnalysisSkippedRepositoriesTabProps = {
  alertTitle: string;
  alertMessage: string;
  skippedRepositoryGroup: VariantAnalysisSkippedRepositoryGroup;

  filterSortState?: RepositoriesFilterSortState;
};

function getSkipReasonAlert(
  title: string,
  message: string,
  repos: VariantAnalysisSkippedRepositoryGroup,
) {
  const repositoriesOmittedText =
    repos.repositoryCount > repos.repositories.length
      ? ` (Only the first ${
          repos.repositories.length > 1
            ? `${repos.repositories.length} repositories are`
            : "repository is"
        } shown.)`
      : "";
  return (
    <Alert
      key="alert"
      type="warning"
      title={title}
      message={message + repositoriesOmittedText}
    />
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  width: 100%;
`;

export const VariantAnalysisSkippedRepositoriesTab = ({
  alertTitle,
  alertMessage,
  skippedRepositoryGroup,
  filterSortState,
}: VariantAnalysisSkippedRepositoriesTabProps) => {
  const repositories = useMemo(() => {
    return skippedRepositoryGroup.repositories
      ?.filter((repository) => {
        return matchesFilter({ repository }, filterSortState);
      })
      ?.sort(compareRepository(filterSortState));
  }, [filterSortState, skippedRepositoryGroup.repositories]);

  return (
    <Container>
      {getSkipReasonAlert(alertTitle, alertMessage, skippedRepositoryGroup)}
      {repositories.map((repo) => (
        <RepoRow key={`repo/${repo.fullName}`} repository={repo} />
      ))}
    </Container>
  );
};
