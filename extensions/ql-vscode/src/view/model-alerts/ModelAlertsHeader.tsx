import { styled } from "styled-components";
import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";
import { ViewTitle } from "../common";
import { ModelAlertsActions } from "./ModelAlertsActions";
import { ModelPacks } from "./ModelPacks";

type Props = {
  viewState: ModelAlertsViewState;
  variantAnalysis: VariantAnalysis;
  openModelPackClick: (path: string) => void;
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
  stopRunClick,
}: Props) => {
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
      </Container>
    </>
  );
};
