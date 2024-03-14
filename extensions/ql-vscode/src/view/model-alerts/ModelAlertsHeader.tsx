import type { ModelAlertsViewState } from "../../model-editor/shared/view-state";
import type { VariantAnalysis } from "../../variant-analysis/shared/variant-analysis";
import { ViewTitle } from "../common";
import { ModelPacks } from "./ModelPacks";

type Props = {
  viewState: ModelAlertsViewState;
  variantAnalysis: VariantAnalysis;
  openModelPackClick: (path: string) => void;
};

export const ModelAlertsHeader = ({
  viewState,
  variantAnalysis,
  openModelPackClick,
}: Props) => {
  return (
    <>
      <ViewTitle>Model evaluation results for {viewState.title}</ViewTitle>
      <ModelPacks
        modelPacks={variantAnalysis.modelPacks || []}
        openModelPackClick={openModelPackClick}
      ></ModelPacks>
    </>
  );
};
