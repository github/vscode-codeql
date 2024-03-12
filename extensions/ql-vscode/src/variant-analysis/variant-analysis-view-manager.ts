import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";
import type { AppCommandManager } from "../common/commands";
import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";

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

  tryGetVariantAnalysis(variantAnalysisId: number): VariantAnalysis | undefined;
  getRepoStates(
    variantAnalysisId: number,
  ): VariantAnalysisScannedRepositoryState[];
  openQueryFile(variantAnalysisId: number): Promise<void>;
  openQueryText(variantAnalysisId: number): Promise<void>;
  cancelVariantAnalysis(variantAnalysisId: number): Promise<void>;
  exportResults(
    variantAnalysisId: number,
    filterSort?: RepositoriesFilterSortStateWithIds,
  ): Promise<void>;
  copyRepoListToClipboard(
    variantAnalysisId: number,
    filterSort?: RepositoriesFilterSortStateWithIds,
  ): Promise<void>;
}
