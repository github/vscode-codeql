import { AppCommandManager } from "../common/commands";

export interface PerformanceEditorViewInterface {
  performanceEditorId: number;
  openView(): Promise<void>;
}

export interface PerformanceEditorViewManager<
  T extends PerformanceEditorViewInterface,
> {
  commandManager: AppCommandManager;

  registerView(view: T): void;
  unregisterView(view: T): void;
  getView(performanceEditorId: number): T | undefined;

  //   getVariantAnalysis(
  //     variantAnalysisId: number,
  //   ): Promise<VariantAnalysis | undefined>;
  //   getRepoStates(
  //     variantAnalysisId: number,
  //   ): Promise<VariantAnalysisScannedRepositoryState[]>;
  openQueryFile(performanceEditorId: number): Promise<void>;
  openQueryText(performanceEditorId: number): Promise<void>;
  cancelVariantAnalysis(performanceEditorId: number): Promise<void>;
}
