import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysisSkippedRepositoryGroup } from '../../remote-queries/shared/variant-analysis';
import { Alert } from '../common';
import { VariantAnalysisSkippedRepositoryRow } from './VariantAnalysisSkippedRepositoryRow';

export type SkippedRepositoriesReason = 'no_access' | 'no_database';

export type VariantAnalysisSkippedRepositoriesTabProps = {
  reason: SkippedRepositoriesReason,
  skippedRepositoryGroup: VariantAnalysisSkippedRepositoryGroup,
};

function getSkipReasonAlertTitle(reason: SkippedRepositoriesReason): string {
  switch (reason) {
    case 'no_access':
      return 'No access';
    case 'no_database':
      return 'No database';
  }
}

function getSkipReasonAlertMessage(
  reason: SkippedRepositoriesReason,
  repos: VariantAnalysisSkippedRepositoryGroup
): string {
  const repositoriesOmittedText = repos.repositoryCount > repos.repositories.length
    ? ` (Only the first ${repos.repositories.length} ${repos.repositories.length > 1 ? 'repositories are' : 'repository is'} shown.)`
    : '';
  switch (reason) {
    case 'no_access':
      return `The following repositories could not be scanned because you do not have read access.${repositoriesOmittedText}`;
    case 'no_database':
      return `The following repositories could not be scanned because they do not have an available CodeQL database.${repositoriesOmittedText}`;
  }
}

function getSkipReasonAlert(
  reason: SkippedRepositoriesReason,
  repos: VariantAnalysisSkippedRepositoryGroup
) {
  return (
    <Alert
      key='alert'
      type='warning'
      title={getSkipReasonAlertTitle(reason)}
      message={getSkipReasonAlertMessage(reason, repos)}
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
  reason,
  skippedRepositoryGroup,
}: VariantAnalysisSkippedRepositoriesTabProps) => {
  return (
    <Container>
      {getSkipReasonAlert(reason, skippedRepositoryGroup)}
      {skippedRepositoryGroup.repositories.map((repo) =>
        <VariantAnalysisSkippedRepositoryRow key={`repo/${repo.fullName}`} repository={repo} />
      )}
    </Container>
  );
};
