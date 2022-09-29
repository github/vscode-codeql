import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisSkippedRepositoryGroup } from '../../remote-queries/shared/variant-analysis';
import { Alert } from '../common';
import { VariantAnalysisSkippedRepositoryRow } from './VariantAnalysisSkippedRepositoryRow';

export type VariantAnalysisSkippedRepositoriesTabProps = {
  alertTitle: string,
  alertMessage: string,
  skippedRepositoryGroup: VariantAnalysisSkippedRepositoryGroup,
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
}: VariantAnalysisSkippedRepositoriesTabProps) => {
  return (
    <Container>
      {getSkipReasonAlert(alertTitle, alertMessage, skippedRepositoryGroup)}
      {skippedRepositoryGroup.repositories.map((repo) =>
        <VariantAnalysisSkippedRepositoryRow key={`repo/${repo.fullName}`} repository={repo} />
      )}
    </Container>
  );
};
