import { env } from 'vscode';
import { QueryHistoryConfig } from './config';
import { LocalQueryInfo, QueryHistoryInfo } from './query-results';

interface InterpolateReplacements {
  t: string; // Start time
  q: string; // Query name
  d: string; // Database/List name
  r: string; // Result count
  s: string; // Status
  f: string; // Query file path
  '%': '%'; // Percent sign
}

export class HistoryItemLabelProvider {
  constructor(private config: QueryHistoryConfig) {
    /**/
  }

  getLabel(item: QueryHistoryInfo) {
    if (item.t === 'remote') {
      return item.remoteQuery.queryName;
    }
    const replacements = this.getLocalInterpolateReplacements(item);
    const rawLabel = item.userSpecifiedLabel ?? (this.config.format || '%q');
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
      : item.t === 'local'
        ? item.getQueryName()
        : item.remoteQuery.queryName;
  }


  private interpolate(rawLabel: string, replacements: InterpolateReplacements): string {
    return rawLabel.replace(/%(.)/g, (match, key: keyof InterpolateReplacements) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });
  }

  private getLocalInterpolateReplacements(item: LocalQueryInfo): InterpolateReplacements {
    const { resultCount = 0, statusString = 'in progress' } = item.completedQuery || {};
    return {
      t: item.startTime,
      q: item.getQueryName(),
      d: item.initialInfo.databaseInfo.name,
      r: resultCount.toString(),
      s: statusString,
      f: item.getQueryFileName(),
      '%': '%',
    };
  }
}
