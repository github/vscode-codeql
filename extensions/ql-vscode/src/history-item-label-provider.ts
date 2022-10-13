import { env } from 'vscode';
import * as path from 'path';
import { QueryHistoryConfig } from './config';
import { LocalQueryInfo, QueryHistoryInfo } from './query-results';
import { RemoteQueryHistoryItem } from './remote-queries/remote-query-history-item';
import { pluralize } from './helpers';
import { VariantAnalysisHistoryItem } from './remote-queries/variant-analysis-history-item';
import { assertNever } from './pure/helpers-pure';

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
    let replacements: InterpolateReplacements;
    switch (item.t) {
      case 'local':
        replacements = this.getLocalInterpolateReplacements(item);
        break;
      case 'remote':
        replacements = this.getRemoteInterpolateReplacements(item);
        break;
      case 'variant-analysis':
        replacements = this.getVariantAnalysisInterpolateReplacements(item);
        break;
      default:
        assertNever(item);
    }

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
    if (item.userSpecifiedLabel) {
      return this.getLabel(item);
    } else {
      switch (item.t) {
        case 'local':
          return item.getQueryName();
        case 'remote':
          return item.remoteQuery.queryName;
        case 'variant-analysis':
          return item.variantAnalysis.query.name;
        default:
          assertNever(item);
      }
    }
  }


  private interpolate(rawLabel: string, replacements: InterpolateReplacements): string {
    const label = rawLabel.replace(/%(.)/g, (match, key: keyof InterpolateReplacements) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });

    return label.replace(/\s+/g, ' ');
  }

  private getLocalInterpolateReplacements(item: LocalQueryInfo): InterpolateReplacements {
    const { resultCount = 0, statusString = 'in progress' } = item.completedQuery || {};
    return {
      t: item.startTime,
      q: item.getQueryName(),
      d: item.initialInfo.databaseInfo.name,
      r: `(${resultCount} results)`,
      s: statusString,
      f: item.getQueryFileName(),
      '%': '%',
    };
  }

  // Return the number of repositories queried if available. Otherwise, use the controller repository name.
  private buildRepoLabel(item: RemoteQueryHistoryItem): string {
    const repositoryCount = item.remoteQuery.repositoryCount;

    if (repositoryCount) {
      return pluralize(repositoryCount, 'repository', 'repositories');
    }

    return `${item.remoteQuery.controllerRepository.owner}/${item.remoteQuery.controllerRepository.name}`;
  }

  private getRemoteInterpolateReplacements(item: RemoteQueryHistoryItem): InterpolateReplacements {
    const resultCount = item.resultCount ? `(${pluralize(item.resultCount, 'result', 'results')})` : '';
    return {
      t: new Date(item.remoteQuery.executionStartTime).toLocaleString(env.language),
      q: `${item.remoteQuery.queryName} (${item.remoteQuery.language})`,
      d: this.buildRepoLabel(item),
      r: resultCount,
      s: item.status,
      f: path.basename(item.remoteQuery.queryFilePath),
      '%': '%'
    };
  }

  private getVariantAnalysisInterpolateReplacements(item: VariantAnalysisHistoryItem): InterpolateReplacements {
    const resultCount = item.resultCount ? `(${pluralize(item.resultCount, 'result', 'results')})` : '';
    return {
      t: new Date(item.variantAnalysis.executionStartTime).toLocaleString(env.language),
      q: `${item.variantAnalysis.query.name} (${item.variantAnalysis.query.language})`,
      d: 'TODO',
      r: resultCount,
      s: item.status,
      f: path.basename(item.variantAnalysis.query.filePath),
      '%': '%',
    };
  }
}
