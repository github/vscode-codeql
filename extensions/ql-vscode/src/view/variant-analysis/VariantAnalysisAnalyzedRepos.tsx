import * as React from 'react';
import styled from 'styled-components';
import { VariantAnalysis, VariantAnalysisScannedRepositoryResult } from '../../remote-queries/shared/variant-analysis';
import { VariantAnalysisAnalyzedRepoItem } from './VariantAnalysisAnalyzedRepoItem';
import { useMemo } from 'react';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1em;
`;

export type VariantAnalysisAnalyzedReposProps = {
  variantAnalysis: VariantAnalysis;
  repositoryResults?: VariantAnalysisScannedRepositoryResult[];
}

export const VariantAnalysisAnalyzedRepos = ({
  variantAnalysis,
  repositoryResults,
}: VariantAnalysisAnalyzedReposProps) => {
  const repositoryResultsById = useMemo(() => {
    const map = new Map<number, VariantAnalysisScannedRepositoryResult>();
    repositoryResults?.forEach((repository) => {
      map.set(repository.repositoryId, repository);
    });
    return map;
  }, [repositoryResults]);

  return (
    <Container>
      {variantAnalysis.scannedRepos?.map(repository => {
        const results = repositoryResultsById.get(repository.repository.id);

        return (
          <VariantAnalysisAnalyzedRepoItem
            key={repository.repository.id}
            repository={repository.repository}
            status={repository.analysisStatus}
            resultCount={repository.resultCount}
            interpretedResults={results?.interpretedResults}
            rawResults={results?.rawResults}
          />
        );
      })}
    </Container>
  );
};
