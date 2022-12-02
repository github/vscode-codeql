import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";

export interface VariantAnalysisViewInterface {
  variantAnalysisId: number;
  openView(): Promise<void>;
}

export interface VariantAnalysisViewManager<
  T extends VariantAnalysisViewInterface,
> {
  registerView(view: T): void;
  unregisterView(view: T): void;
  getView(variantAnalysisId: number): T | undefined;

  getVariantAnalysis(
    variantAnalysisId: number,
  ): Promise<VariantAnalysis | undefined>;
  getRepoStates(
    variantAnalysisId: number,
  ): Promise<VariantAnalysisScannedRepositoryState[]>;
}
