import { RemoteQueryHistoryItem } from "./remote-queries/remote-query-history-item";
import { VariantAnalysisHistoryItem } from "./remote-queries/variant-analysis-history-item";
import { LocalQueryInfo } from "./query-results";
import { assertNever } from "./pure/helpers-pure";
import { pluralize } from "./pure/word";
import {
  hasRepoScanCompleted,
  getActionsWorkflowRunUrl as getVariantAnalysisActionsWorkflowRunUrl,
} from "./remote-queries/shared/variant-analysis";

export type QueryHistoryInfo =
  | LocalQueryInfo
  | RemoteQueryHistoryItem
  | VariantAnalysisHistoryItem;

export function getRawQueryName(item: QueryHistoryInfo): string {
  switch (item.t) {
    case "local":
      return item.getQueryName();
    case "remote":
      return item.remoteQuery.queryName;
    case "variant-analysis":
      return item.variantAnalysis.query.name;
    default:
      assertNever(item);
  }
}

/**
 * Gets an identifier for the query history item which could be
 * a local/remote query or a variant analysis. This id isn't guaranteed
 * to be unique for each item in the query history.
 * @param item the history item.
 * @returns the id of the query or variant analysis.
 */
export function getQueryId(item: QueryHistoryInfo): string {
  switch (item.t) {
    case "local":
      return item.initialInfo.id;
    case "remote":
      return item.queryId;
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
    case "remote":
      return item.remoteQuery.queryText;
    case "variant-analysis":
      return item.variantAnalysis.query.text;
    default:
      assertNever(item);
  }
}

export function buildRepoLabel(
  item: RemoteQueryHistoryItem | VariantAnalysisHistoryItem,
): string {
  if (item.t === "remote") {
    // Return the number of repositories queried if available. Otherwise, use the controller repository name.
    const repositoryCount = item.remoteQuery.repositoryCount;

    if (repositoryCount) {
      return pluralize(repositoryCount, "repository", "repositories");
    }
    return `${item.remoteQuery.controllerRepository.owner}/${item.remoteQuery.controllerRepository.name}`;
  } else if (item.t === "variant-analysis") {
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
  } else {
    assertNever(item);
  }
}

export function getActionsWorkflowRunUrl(
  item: RemoteQueryHistoryItem | VariantAnalysisHistoryItem,
): string {
  if (item.t === "remote") {
    const {
      actionsWorkflowRunId: workflowRunId,
      controllerRepository: { owner, name },
    } = item.remoteQuery;
    return `https://github.com/${owner}/${name}/actions/runs/${workflowRunId}`;
  } else if (item.t === "variant-analysis") {
    return getVariantAnalysisActionsWorkflowRunUrl(item.variantAnalysis);
  } else {
    assertNever(item);
  }
}
