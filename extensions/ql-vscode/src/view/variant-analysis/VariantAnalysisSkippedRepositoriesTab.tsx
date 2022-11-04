import * as React from 'react';
import { useMemo } from 'react';
import styled from 'styled-components';
import { VariantAnalysisSkippedRepositoryGroup } from '../../remote-queries/shared/variant-analysis';
import { Alert } from '../common';
import { RepoRow } from './RepoRow';
import { matchesSearchValue } from './filterSort';

export type VariantAnalysisSkippedRepositoriesTabProps = {
  alertTitle: string,
  alertMessage: string,
  skippedRepositoryGroup: VariantAnalysisSkippedRepositoryGroup,

  searchValue?: string,
};

function getSkipReasonAlert(
  title: string,
  message: string,
  repos: VariantAnalysisSkippedRepositoryGroup
) {
  const repositoriesOmittedText = repos.repositoryCount > repos.repositories.length
    ? ` (Only the first ${repos.repositories.length > 1 ? `${repos.repositories.length} repositories are` : 'repository is'} shown.)`
    : '';
  return (
    <Alert
      key='alert'
      type='warning'
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
  searchValue,
}: VariantAnalysisSkippedRepositoriesTabProps) => {
  const repositories = useMemo(() => {
    if (searchValue) {
      return skippedRepositoryGroup.repositories?.filter((repo) => {
        return matchesSearchValue(repo, searchValue);
      });
    }

    return skippedRepositoryGroup.repositories;
  }, [searchValue, skippedRepositoryGroup.repositories]);

  return (
    <Container>
      {getSkipReasonAlert(alertTitle, alertMessage, skippedRepositoryGroup)}
      {repositories.map((repo) =>
        <RepoRow key={`repo/${repo.fullName}`} repository={repo} />
      )}
    </Container>
  );
};
