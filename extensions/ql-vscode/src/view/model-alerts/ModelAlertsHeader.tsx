import { useMemo } from "react";
import { parseDate } from "../../common/date";
import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import {
  getSkippedRepoCount,
  getTotalResultCount,
  hasRepoScanCompleted,
  isRepoScanSuccessful,
} from "../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";
import { ViewTitle } from "../common";
import { ModelPacks } from "./ModelPacks";
import { VariantAnalysisStats } from "../variant-analysis/VariantAnalysisStats";

type Props = {
  viewState: ModelAlertsViewState;
  variantAnalysis: VariantAnalysis;
  openModelPackClick: (path: string) => void;
  onViewLogsClick?: () => void;
};

export const ModelAlertsHeader = ({
  viewState,
  variantAnalysis,
  openModelPackClick,
  onViewLogsClick,
}: Props) => {
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

  return (
    <>
      <ViewTitle>Model evaluation results for {viewState.title}</ViewTitle>
      <ModelPacks
        modelPacks={variantAnalysis.modelPacks || []}
        openModelPackClick={openModelPackClick}
      ></ModelPacks>
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
    </>
  );
};
