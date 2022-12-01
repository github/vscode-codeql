import * as React from "react";
import { useMemo } from "react";
import styled from "styled-components";
import {
  getSkippedRepoCount,
  getTotalResultCount,
  hasRepoScanCompleted,
  VariantAnalysis,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState,
} from "../../remote-queries/shared/variant-analysis";
import { QueryDetails } from "./QueryDetails";
import { VariantAnalysisActions } from "./VariantAnalysisActions";
import { VariantAnalysisStats } from "./VariantAnalysisStats";
import { parseDate } from "../../pure/date";
import { basename } from "../common/path";

export type VariantAnalysisHeaderProps = {
  variantAnalysis: VariantAnalysis;
  repositoryStates?: VariantAnalysisScannedRepositoryState[];

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

export const VariantAnalysisHeader = ({
  variantAnalysis,
  repositoryStates,
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
  const resultCount = useMemo(() => {
    return getTotalResultCount(variantAnalysis.scannedRepos);
  }, [variantAnalysis.scannedRepos]);
  const hasSkippedRepos = useMemo(() => {
    return getSkippedRepoCount(variantAnalysis.skippedRepos) > 0;
  }, [variantAnalysis.skippedRepos]);
  const hasDownloadedRepos = useMemo(() => {
    return (
      repositoryStates?.some(
        (repo) =>
          repo.downloadStatus ===
          VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      ) ?? false
    );
  }, [repositoryStates]);

  return (
    <Container>
      <Row>
        <QueryDetails
          queryName={variantAnalysis.query.name}
          queryFileName={basename(variantAnalysis.query.filePath)}
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
        />
      </Row>
      <VariantAnalysisStats
        variantAnalysisStatus={variantAnalysis.status}
        totalRepositoryCount={totalScannedRepositoryCount}
        completedRepositoryCount={completedRepositoryCount}
        resultCount={resultCount}
        hasWarnings={hasSkippedRepos}
        createdAt={parseDate(variantAnalysis.createdAt)}
        completedAt={parseDate(variantAnalysis.completedAt)}
        onViewLogsClick={onViewLogsClick}
      />
    </Container>
  );
};
