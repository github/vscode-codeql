import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import { defaultFilterSortState } from "./shared/variant-analysis-filter-sort";
import type { VariantAnalysis } from "./shared/variant-analysis";
import type { Credentials } from "../common/authentication";
import type { NotificationLogger } from "../common/logging";
import type { App } from "../common/app";
import type { CodeQLCliServer } from "../codeql-cli/cli";

/**
 * Generates autofixes for the results of a variant analysis.
 */
export async function viewAutofixesForVariantAnalysisResults(
  variantAnalysisId: number,
  filterSort: RepositoriesFilterSortStateWithIds = defaultFilterSortState,
  variantAnalyses: Map<number, VariantAnalysis>,
  credentials: Credentials,
  logger: NotificationLogger,
  storagePath: string,
  app: App,
  cliServer: CodeQLCliServer,
): Promise<void> {
  // TODO
}
