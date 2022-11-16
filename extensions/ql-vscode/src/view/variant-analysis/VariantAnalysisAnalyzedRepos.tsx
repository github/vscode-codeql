import * as React from 'react';
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { RepoRow } from './RepoRow';
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState
} from '../../remote-queries/shared/variant-analysis';
import {
  filterAndSortRepositoriesWithResults,
  RepositoriesFilterSortState,
} from '../../pure/variant-analysis-filter-sort';

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

  selectedRepositoryIds?: number[];
  setSelectedRepositoryIds?: Dispatch<SetStateAction<number[]>>;
}

export const VariantAnalysisAnalyzedRepos = ({
  variantAnalysis,
  repositoryStates,
  repositoryResults,
  filterSortState,
  selectedRepositoryIds,
  setSelectedRepositoryIds,
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
    return filterAndSortRepositoriesWithResults(variantAnalysis.scannedRepos, filterSortState);
  }, [filterSortState, variantAnalysis.scannedRepos]);

  const onSelectedChange = useCallback((repositoryId: number, selected: boolean) => {
    setSelectedRepositoryIds?.((prevSelectedRepositoryIds) => {
      if (selected) {
        if (prevSelectedRepositoryIds.includes(repositoryId)) {
          return prevSelectedRepositoryIds;
        }

        return [...prevSelectedRepositoryIds, repositoryId];
      } else {
        return prevSelectedRepositoryIds.filter((id) => id !== repositoryId);
      }
    });
  }, [setSelectedRepositoryIds]);

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
            selected={selectedRepositoryIds?.includes(repository.repository.id)}
            onSelectedChange={onSelectedChange}
          />
        );
      })}
    </Container>
  );
};
