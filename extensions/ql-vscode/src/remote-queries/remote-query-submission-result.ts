import { RemoteQuery } from "./remote-query";
import { VariantAnalysis } from "./shared/variant-analysis";

export interface RemoteQuerySubmissionResult {
  queryDirPath?: string;
  query?: RemoteQuery;
  variantAnalysis?: VariantAnalysis;
}
