import { useMemo } from "react";
import { parseDate } from "../../common/date";
import { styled } from "styled-components";
import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import {
  getSkippedRepoCount,
  getTotalResultCount,
  hasRepoScanCompleted,
  isRepoScanSuccessful,
} from "../../variant-analysis/shared/variant-analysis";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";
import { ViewTitle } from "../common";
import { ModelAlertsActions } from "./ModelAlertsActions";
import { ModelPacks } from "./ModelPacks";
import { VariantAnalysisStats } from "../variant-analysis/VariantAnalysisStats";

type Props = {
  viewState: ModelAlertsViewState;
  variantAnalysis: VariantAnalysis;
  openModelPackClick: (path: string) => void;
  onViewLogsClick?: () => void;
  stopRunClick: () => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
`;

export const ModelAlertsHeader = ({
  viewState,
  variantAnalysis,
  openModelPackClick,
  onViewLogsClick,
  stopRunClick,
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
      <Container>
        <Row>
          <ViewTitle>Model evaluation results for {viewState.title}</ViewTitle>
        </Row>
        <Row>
          <ModelPacks
            modelPacks={variantAnalysis.modelPacks || []}
            openModelPackClick={openModelPackClick}
          ></ModelPacks>
          <ModelAlertsActions
            variantAnalysisStatus={variantAnalysis.status}
            onStopRunClick={stopRunClick}
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
    </>
  );
};
