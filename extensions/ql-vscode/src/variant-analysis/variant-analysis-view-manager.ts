import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";
import { AppCommandManager } from "../common/commands";

export interface VariantAnalysisViewInterface {
  variantAnalysisId: number;
  openView(): Promise<void>;
}

export interface VariantAnalysisViewManager<
  T extends VariantAnalysisViewInterface,
> {
  commandManager: AppCommandManager;

  registerView(view: T): void;
  unregisterView(view: T): void;
  getView(variantAnalysisId: number): T | undefined;

  getVariantAnalysis(
    variantAnalysisId: number,
  ): Promise<VariantAnalysis | undefined>;
  getRepoStates(
    variantAnalysisId: number,
  ): Promise<VariantAnalysisScannedRepositoryState[]>;
  openQueryFile(variantAnalysisId: number): Promise<void>;
  cancelVariantAnalysis(variantAnalysisId: number): Promise<void>;
}
