import { env } from "vscode";
import { basename } from "path";
import { QueryHistoryConfig } from "../config";
import { LocalQueryInfo } from "../query-results";
import {
  buildRepoLabel,
  getRawQueryName,
  QueryHistoryInfo,
} from "./query-history-info";
import { VariantAnalysisHistoryItem } from "./variant-analysis-history-item";
import { assertNever } from "../pure/helpers-pure";
import { pluralize } from "../pure/word";
import { humanizeQueryStatus } from "../query-status";

interface InterpolateReplacements {
  t: string; // Start time
  q: string; // Query name
  d: string; // Database/Controller repo name
  r: string; // Result count/Empty
  s: string; // Status
  f: string; // Query file name
  "%": "%"; // Percent sign
}

export class HistoryItemLabelProvider {
  constructor(private config: QueryHistoryConfig) {
    /**/
  }

  getLabel(item: QueryHistoryInfo) {
    let replacements: InterpolateReplacements;
    switch (item.t) {
      case "local":
        replacements = this.getLocalInterpolateReplacements(item);
        break;
      case "variant-analysis":
        replacements = this.getVariantAnalysisInterpolateReplacements(item);
        break;
      default:
        assertNever(item);
    }

    const rawLabel = item.userSpecifiedLabel ?? (this.config.format || "%q");

    return this.interpolate(rawLabel, replacements);
  }

  /**
   * If there is a user-specified label for this query, interpolate and use that.
   * Otherwise, use the raw name of this query.
   *
   * @returns the name of the query, unless there is a custom label for this query.
   */
  getShortLabel(item: QueryHistoryInfo): string {
    return item.userSpecifiedLabel
      ? this.getLabel(item)
      : getRawQueryName(item);
  }

  private interpolate(
    rawLabel: string,
    replacements: InterpolateReplacements,
  ): string {
    const label = rawLabel.replace(
      /%(.)/g,
      (match, key: keyof InterpolateReplacements) => {
        const replacement = replacements[key];
        return replacement !== undefined ? replacement : match;
      },
    );

    return label.replace(/\s+/g, " ");
  }

  private getLocalInterpolateReplacements(
    item: LocalQueryInfo,
  ): InterpolateReplacements {
    const { resultCount = 0, statusString = "in progress" } =
      item.completedQuery || {};
    return {
      t: item.startTime,
      q: item.getQueryName(),
      d: item.initialInfo.databaseInfo.name,
      r: `(${resultCount} results)`,
      s: statusString,
      f: item.getQueryFileName(),
      "%": "%",
    };
  }

  private getVariantAnalysisInterpolateReplacements(
    item: VariantAnalysisHistoryItem,
  ): InterpolateReplacements {
    const resultCount = item.resultCount
      ? `(${pluralize(item.resultCount, "result", "results")})`
      : "";
    return {
      t: new Date(item.variantAnalysis.executionStartTime).toLocaleString(
        env.language,
      ),
      q: `${item.variantAnalysis.query.name} (${item.variantAnalysis.query.language})`,
      d: buildRepoLabel(item),
      r: resultCount,
      s: humanizeQueryStatus(item.status),
      f: basename(item.variantAnalysis.query.filePath),
      "%": "%",
    };
  }
}
