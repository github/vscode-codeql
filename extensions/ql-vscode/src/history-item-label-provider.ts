import { env } from 'vscode';
import * as path from 'path';
import { QueryHistoryConfig } from './config';
import { LocalQueryInfo, QueryHistoryInfo } from './query-results';
import { RemoteQueryHistoryItem } from './remote-queries/remote-query-history-item';

interface InterpolateReplacements {
  t: string; // Start time
  q: string; // Query name
  d: string; // Database/Controller repo name
  r: string; // Result count/Empty
  s: string; // Status
  f: string; // Query file name
  '%': '%'; // Percent sign
}

export class HistoryItemLabelProvider {
  constructor(private config: QueryHistoryConfig) {
    /**/
  }

  getLabel(item: QueryHistoryInfo) {
    const replacements = item.t === 'local'
      ? this.getLocalInterpolateReplacements(item)
      : this.getRemoteInterpolateReplacements(item);

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
      r: `${resultCount} results`,
      s: statusString,
      f: item.getQueryFileName(),
      '%': '%',
    };
  }

  private getRemoteInterpolateReplacements(item: RemoteQueryHistoryItem): InterpolateReplacements {
    return {
      t: new Date(item.remoteQuery.executionStartTime).toLocaleString(env.language),
      q: item.remoteQuery.queryName,

      // There is no database name for remote queries. Instead use the controller repository name.
      d: `${item.remoteQuery.controllerRepository.owner}/${item.remoteQuery.controllerRepository.name}`,

      // There is no synchronous way to get the results count.
      r: '',
      s: item.status,
      f: path.basename(item.remoteQuery.queryFilePath),
      '%': '%'
    };
  }
}
