import { env } from "vscode";
import { basename } from "path";
import type { QueryHistoryConfig } from "../config";
import type { LocalQueryInfo } from "../query-results";
import type { QueryHistoryInfo } from "./query-history-info";
import {
  buildRepoLabel,
  getLanguage,
  getRawQueryName,
} from "./query-history-info";
import type { VariantAnalysisHistoryItem } from "./variant-analysis-history-item";
import { assertNever } from "../common/helpers-pure";
import { pluralize } from "../common/word";
import { humanizeQueryStatus } from "./query-status";
import { substituteConfigVariables } from "../common/config-template";

type LabelVariables = {
  startTime: string;
  queryName: string;
  databaseName: string;
  resultCount: string;
  status: string;
  queryFileBasename: string;
  queryLanguage: string;
};

const legacyVariableInterpolateReplacements: Record<
  keyof LabelVariables,
  string
> = {
  startTime: "t",
  queryName: "q",
  databaseName: "d",
  resultCount: "r",
  status: "s",
  queryFileBasename: "f",
  queryLanguage: "l",
};

// If any of the "legacy" variables are used, we need to use legacy interpolation.
const legacyLabelRegex = new RegExp(
  `%([${Object.values(legacyVariableInterpolateReplacements).join("")}%])`,
  "g",
);

export class HistoryItemLabelProvider {
  constructor(private config: QueryHistoryConfig) {
    /**/
  }

  getLabel(item: QueryHistoryInfo) {
    let variables: LabelVariables;
    switch (item.t) {
      case "local":
        variables = this.getLocalVariables(item);
        break;
      case "variant-analysis":
        variables = this.getVariantAnalysisVariables(item);
        break;
      default:
        assertNever(item);
    }

    const rawLabel =
      item.userSpecifiedLabel ?? (this.config.format || "${queryName}");

    if (legacyLabelRegex.test(rawLabel)) {
      return this.legacyInterpolate(rawLabel, variables);
    }

    return substituteConfigVariables(rawLabel, variables).replace(/\s+/g, " ");
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

  private legacyInterpolate(
    rawLabel: string,
    variables: LabelVariables,
  ): string {
    const replacements = Object.entries(variables).reduce(
      (acc, [key, value]) => {
        acc[
          legacyVariableInterpolateReplacements[key as keyof LabelVariables]
        ] = value;
        return acc;
      },
      {
        "%": "%",
      } as Record<string, string>,
    );

    const label = rawLabel.replace(/%(.)/g, (match, key: string) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });

    return label.replace(/\s+/g, " ");
  }

  private getLocalVariables(item: LocalQueryInfo): LabelVariables {
    const { resultCount = 0, message = "in progress" } =
      item.completedQuery || {};
    return {
      startTime: item.startTime,
      queryName: item.getQueryName(),
      databaseName: item.databaseName,
      resultCount: `(${resultCount} results)`,
      status: message,
      queryFileBasename: item.getQueryFileName(),
      queryLanguage: this.getLanguageLabel(item),
    };
  }

  private getVariantAnalysisVariables(
    item: VariantAnalysisHistoryItem,
  ): LabelVariables {
    const resultCount = item.resultCount
      ? `(${pluralize(item.resultCount, "result", "results")})`
      : "";
    return {
      startTime: new Date(
        item.variantAnalysis.executionStartTime,
      ).toLocaleString(env.language),
      queryName: `${item.variantAnalysis.query.name} (${item.variantAnalysis.language})`,
      databaseName: buildRepoLabel(item),
      resultCount,
      status: humanizeQueryStatus(item.status),
      queryFileBasename: basename(item.variantAnalysis.query.filePath),
      queryLanguage: this.getLanguageLabel(item),
    };
  }

  private getLanguageLabel(item: QueryHistoryInfo): string {
    const language = getLanguage(item);
    return language === undefined ? "unknown" : `${language}`;
  }
}
