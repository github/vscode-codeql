import { VariantAnalysis } from "./variant-analysis";

export type VariantAnalysisMonitorStatus = "Completed" | "Canceled";

export interface VariantAnalysisMonitorResult {
  status: VariantAnalysisMonitorStatus;
  scannedReposDownloaded?: number[];
  variantAnalysis?: VariantAnalysis;
}
