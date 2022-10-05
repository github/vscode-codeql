export interface VariantAnalysisViewInterface {
  variantAnalysisId: number;
  openView(): Promise<void>;
}

export interface VariantAnalysisViewManager<T extends VariantAnalysisViewInterface> {
  registerView(view: T): void;
  unregisterView(view: T): void;
}
