import type { VariantAnalysisHistoryItem } from "./variant-analysis-history-item";
import type { LocalQueryInfo } from "../query-results";
import { assertNever } from "../common/helpers-pure";
import { pluralize } from "../common/word";
import {
  hasRepoScanCompleted,
  getActionsWorkflowRunUrl as getVariantAnalysisActionsWorkflowRunUrl,
} from "../variant-analysis/shared/variant-analysis";
import type { QueryLanguage } from "../common/query-language";
import { getGitHubInstanceUrl } from "../config";

export type QueryHistoryInfo = LocalQueryInfo | VariantAnalysisHistoryItem;

export function getRawQueryName(item: QueryHistoryInfo): string {
  switch (item.t) {
    case "local":
      return item.getQueryName();
    case "variant-analysis":
      return item.variantAnalysis.query.name;
    default:
      assertNever(item);
  }
}

/**
 * Gets an identifier for the query history item which could be
 * a local query or a variant analysis. This id isn't guaranteed
 * to be unique for each item in the query history.
 * @param item the history item.
 * @returns the id of the query or variant analysis.
 */
export function getQueryId(item: QueryHistoryInfo): string {
  switch (item.t) {
    case "local":
      return item.initialInfo.id;
    case "variant-analysis":
      return item.variantAnalysis.id.toString();
    default:
      assertNever(item);
  }
}

export function getQueryText(item: QueryHistoryInfo): string {
  switch (item.t) {
    case "local":
      return item.initialInfo.queryText;
    case "variant-analysis":
      return item.variantAnalysis.query.text;
    default:
      assertNever(item);
  }
}

export function getLanguage(item: QueryHistoryInfo): QueryLanguage | undefined {
  switch (item.t) {
    case "local":
      return item.initialInfo.databaseInfo.language;
    case "variant-analysis":
      return item.variantAnalysis.language;
    default:
      assertNever(item);
  }
}

export function buildRepoLabel(item: VariantAnalysisHistoryItem): string {
  const totalScannedRepositoryCount =
    item.variantAnalysis.scannedRepos?.length ?? 0;
  const completedRepositoryCount =
    item.variantAnalysis.scannedRepos?.filter((repo) =>
      hasRepoScanCompleted(repo),
    ).length ?? 0;

  return `${completedRepositoryCount}/${pluralize(
    totalScannedRepositoryCount,
    "repository",
    "repositories",
  )}`; // e.g. "2/3 repositories"
}

export function getActionsWorkflowRunUrl(
  item: VariantAnalysisHistoryItem,
): string {
  return getVariantAnalysisActionsWorkflowRunUrl(
    item.variantAnalysis,
    getGitHubInstanceUrl(),
  );
}
