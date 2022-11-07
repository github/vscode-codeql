import * as React from 'react';
import { useMemo } from 'react';
import styled from 'styled-components';
import { RepoRow } from './RepoRow';
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState
} from '../../remote-queries/shared/variant-analysis';
import { compareWithResults, matchesFilter, RepositoriesFilterSortState } from './filterSort';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  width: 100%;
`;

export type VariantAnalysisAnalyzedReposProps = {
  variantAnalysis: VariantAnalysis;
  repositoryStates?: VariantAnalysisScannedRepositoryState[];
  repositoryResults?: VariantAnalysisScannedRepositoryResult[];

  filterSortState?: RepositoriesFilterSortState;
}

export const VariantAnalysisAnalyzedRepos = ({
  variantAnalysis,
  repositoryStates,
  repositoryResults,
  filterSortState,
}: VariantAnalysisAnalyzedReposProps) => {
  const repositoryStateById = useMemo(() => {
    const map = new Map<number, VariantAnalysisScannedRepositoryState>();
    repositoryStates?.forEach((repository) => {
      map.set(repository.repositoryId, repository);
    });
    return map;
  }, [repositoryStates]);

  const repositoryResultsById = useMemo(() => {
    const map = new Map<number, VariantAnalysisScannedRepositoryResult>();
    repositoryResults?.forEach((repository) => {
      map.set(repository.repositoryId, repository);
    });
    return map;
  }, [repositoryResults]);

  const repositories = useMemo(() => {
    return variantAnalysis.scannedRepos?.filter((repoTask) => {
      return matchesFilter(repoTask.repository, filterSortState);
    })?.sort(compareWithResults(filterSortState));
  }, [filterSortState, variantAnalysis.scannedRepos]);

  return (
    <Container>
      {repositories?.map(repository => {
        const state = repositoryStateById.get(repository.repository.id);
        const results = repositoryResultsById.get(repository.repository.id);

        return (
          <RepoRow
            key={repository.repository.id}
            repository={repository.repository}
            status={repository.analysisStatus}
            downloadStatus={state?.downloadStatus}
            resultCount={repository.resultCount}
            interpretedResults={results?.interpretedResults}
            rawResults={results?.rawResults}
          />
        );
      })}
    </Container>
  );
};
