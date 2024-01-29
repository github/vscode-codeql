import { useMemo } from "react";
import { styled } from "styled-components";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryState,
} from "../../variant-analysis/shared/variant-analysis";
import {
  getSkippedRepoCount,
  getTotalResultCount,
  hasRepoScanCompleted,
  isRepoScanSuccessful,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../../variant-analysis/shared/variant-analysis";
import { QueryDetails } from "./QueryDetails";
import { VariantAnalysisActions } from "./VariantAnalysisActions";
import { VariantAnalysisStats } from "./VariantAnalysisStats";
import { parseDate } from "../../common/date";
import { basename } from "../../common/path";
import type { RepositoriesFilterSortState } from "../../variant-analysis/shared/variant-analysis-filter-sort";
import {
  defaultFilterSortState,
  filterAndSortRepositoriesWithResults,
} from "../../variant-analysis/shared/variant-analysis-filter-sort";
import { ViewTitle } from "../common";

type VariantAnalysisHeaderProps = {
  variantAnalysis: VariantAnalysis;
  repositoryStates?: VariantAnalysisScannedRepositoryState[];
  filterSortState?: RepositoriesFilterSortState;
  selectedRepositoryIds?: number[];

  onOpenQueryFileClick: () => void;
  onViewQueryTextClick: () => void;

  onStopQueryClick: () => void;

  onCopyRepositoryListClick: () => void;
  onExportResultsClick: () => void;

  onViewLogsClick?: () => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2em;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
`;

const QueryInfo = ({
  variantAnalysis,
  onOpenQueryFileClick,
  onViewQueryTextClick,
}: {
  variantAnalysis: VariantAnalysis;
  onOpenQueryFileClick: () => void;
  onViewQueryTextClick: () => void;
}) => {
  if (variantAnalysis.queries) {
    return <ViewTitle>{variantAnalysis.queries?.count} queries</ViewTitle>;
  } else {
    return (
      <QueryDetails
        queryName={variantAnalysis.query.name}
        queryFileName={basename(variantAnalysis.query.filePath)}
        onOpenQueryFileClick={onOpenQueryFileClick}
        onViewQueryTextClick={onViewQueryTextClick}
      />
    );
  }
};

export const VariantAnalysisHeader = ({
  variantAnalysis,
  repositoryStates,
  filterSortState,
  selectedRepositoryIds,
  onOpenQueryFileClick,
  onViewQueryTextClick,
  onStopQueryClick,
  onCopyRepositoryListClick,
  onExportResultsClick,
  onViewLogsClick,
}: VariantAnalysisHeaderProps) => {
  const totalScannedRepositoryCount = useMemo(() => {
    return variantAnalysis.scannedRepos?.length ?? 0;
  }, [variantAnalysis.scannedRepos]);
  const completedRepositoryCount = useMemo(() => {
    return (
      variantAnalysis.scannedRepos?.filter((repo) => hasRepoScanCompleted(repo))
        ?.length ?? 0
    );
  }, [variantAnalysis.scannedRepos]);
  const successfulRepositoryCount = useMemo(() => {
    return (
      variantAnalysis.scannedRepos?.filter((repo) => isRepoScanSuccessful(repo))
        ?.length ?? 0
    );
  }, [variantAnalysis.scannedRepos]);
  const resultCount = useMemo(() => {
    return getTotalResultCount(variantAnalysis.scannedRepos);
  }, [variantAnalysis.scannedRepos]);
  const skippedRepositoryCount = useMemo(() => {
    return getSkippedRepoCount(variantAnalysis.skippedRepos);
  }, [variantAnalysis.skippedRepos]);
  const filteredRepositories = useMemo(() => {
    return filterAndSortRepositoriesWithResults(variantAnalysis.scannedRepos, {
      ...defaultFilterSortState,
      ...filterSortState,
      repositoryIds: selectedRepositoryIds,
    });
  }, [filterSortState, selectedRepositoryIds, variantAnalysis.scannedRepos]);
  const hasDownloadedRepos = useMemo(() => {
    const repositoryStatesById = new Map<
      number,
      VariantAnalysisScannedRepositoryState
    >();
    if (repositoryStates) {
      for (const repositoryState of repositoryStates) {
        repositoryStatesById.set(repositoryState.repositoryId, repositoryState);
      }
    }

    return filteredRepositories?.some((repo) => {
      return (
        repositoryStatesById.get(repo.repository.id)?.downloadStatus ===
        VariantAnalysisScannedRepositoryDownloadStatus.Succeeded
      );
    });
  }, [repositoryStates, filteredRepositories]);
  const hasReposWithResults = useMemo(() => {
    return filteredRepositories?.some(
      (repo) => repo.resultCount && repo.resultCount > 0,
    );
  }, [filteredRepositories]);

  return (
    <Container>
      <Row>
        <QueryInfo
          variantAnalysis={variantAnalysis}
          onOpenQueryFileClick={onOpenQueryFileClick}
          onViewQueryTextClick={onViewQueryTextClick}
        />
        <VariantAnalysisActions
          variantAnalysisStatus={variantAnalysis.status}
          showResultActions={(resultCount ?? 0) > 0}
          onStopQueryClick={onStopQueryClick}
          onCopyRepositoryListClick={onCopyRepositoryListClick}
          onExportResultsClick={onExportResultsClick}
          stopQueryDisabled={!variantAnalysis.actionsWorkflowRunId}
          exportResultsDisabled={!hasDownloadedRepos}
          copyRepositoryListDisabled={!hasReposWithResults}
          hasFilteredRepositories={
            variantAnalysis.scannedRepos?.length !==
            filteredRepositories?.length
          }
          hasSelectedRepositories={
            selectedRepositoryIds && selectedRepositoryIds.length > 0
          }
        />
      </Row>
      <VariantAnalysisStats
        variantAnalysisStatus={variantAnalysis.status}
        totalRepositoryCount={totalScannedRepositoryCount}
        completedRepositoryCount={completedRepositoryCount}
        successfulRepositoryCount={successfulRepositoryCount}
        skippedRepositoryCount={skippedRepositoryCount}
        resultCount={resultCount}
        createdAt={parseDate(variantAnalysis.createdAt)}
        completedAt={parseDate(variantAnalysis.completedAt)}
        onViewLogsClick={onViewLogsClick}
      />
    </Container>
  );
};
