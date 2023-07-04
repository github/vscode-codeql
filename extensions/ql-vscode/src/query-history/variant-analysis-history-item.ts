import { QueryStatus } from "./query-status";
import { VariantAnalysis } from "../variant-analysis/shared/variant-analysis";

/**
 * Information about a variant analysis.
 */
export interface VariantAnalysisHistoryItem {
  readonly t: "variant-analysis";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  variantAnalysis: VariantAnalysis;
  userSpecifiedLabel?: string;
}
