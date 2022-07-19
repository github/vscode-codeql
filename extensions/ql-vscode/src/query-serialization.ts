import * as fs from 'fs-extra';
import * as path from 'path';

import { showAndLogErrorMessage } from './helpers';
import { asyncFilter, getErrorMessage, getErrorStack } from './pure/helpers-pure';
import { CompletedQueryInfo, LocalQueryInfo, QueryHistoryInfo } from './query-results';
import { QueryStatus } from './query-status';
import { QueryEvaluationInfo } from './run-queries';

export async function slurpQueryHistory(fsPath: string): Promise<QueryHistoryInfo[]> {
  try {
    if (!(await fs.pathExists(fsPath))) {
      return [];
    }

    const data = await fs.readFile(fsPath, 'utf8');
    const obj = JSON.parse(data);
    if (obj.version !== 1) {
      void showAndLogErrorMessage(`Unsupported query history format: v${obj.version}. `);
      return [];
    }

    const queries = obj.queries;
    const parsedQueries = queries.map((q: QueryHistoryInfo) => {

      // Need to explicitly set prototype since reading in from JSON will not
      // do this automatically. Note that we can't call the constructor here since
      // the constructor invokes extra logic that we don't want to do.
      if (q.t === 'local') {
        Object.setPrototypeOf(q, LocalQueryInfo.prototype);

        // Date instances are serialized as strings. Need to
        // convert them back to Date instances.
        (q.initialInfo as any).start = new Date(q.initialInfo.start);
        if (q.completedQuery) {
          // Again, need to explicitly set prototypes.
          Object.setPrototypeOf(q.completedQuery, CompletedQueryInfo.prototype);
          Object.setPrototypeOf(q.completedQuery.query, QueryEvaluationInfo.prototype);
          // slurped queries do not need to be disposed
          q.completedQuery.dispose = () => { /**/ };
        }
      } else if (q.t === 'remote') {
        // A bug was introduced that didn't set the completed flag in query history
        // items. The following code makes sure that the flag is set in order to
        // "patch" older query history items.
        if (q.status === QueryStatus.Completed) {
          q.completed = true;
        }
      }
      return q;
    });

    // filter out queries that have been deleted on disk
    // most likely another workspace has deleted them because the
    // queries aged out.
    return asyncFilter(parsedQueries, async (q) => {
      if (q.t === 'remote') {
        // the slurper doesn't know where the remote queries are stored
        // so we need to assume here that they exist. Later, we check to
        // see if they exist on disk.
        return true;
      }
      const resultsPath = q.completedQuery?.query.resultsPaths.resultsPath;
      return !!resultsPath && await fs.pathExists(resultsPath);
    });
  } catch (e) {
    void showAndLogErrorMessage('Error loading query history.', {
      fullMessage: ['Error loading query history.', getErrorStack(e)].join('\n'),
    });
    // since the query history is invalid, it should be deleted so this error does not happen on next startup.
    await fs.remove(fsPath);
    return [];
  }
}

/**
 * Save the query history to disk. It is not necessary that the parent directory
 * exists, but if it does, it must be writable. An existing file will be overwritten.
 *
 * Any errors will be rethrown.
 *
 * @param queries the list of queries to save.
 * @param fsPath the path to save the queries to.
 */
export async function splatQueryHistory(queries: QueryHistoryInfo[], fsPath: string): Promise<void> {
  try {
    if (!(await fs.pathExists(fsPath))) {
      await fs.mkdir(path.dirname(fsPath), { recursive: true });
    }
    // remove incomplete local queries since they cannot be recreated on restart
    const filteredQueries = queries.filter(q => q.t === 'local' ? q.completedQuery !== undefined : true);
    const data = JSON.stringify({
      version: 1,
      queries: filteredQueries
    }, null, 2);
    await fs.writeFile(fsPath, data);
  } catch (e) {
    throw new Error(`Error saving query history to ${fsPath}: ${getErrorMessage(e)}`);
  }
}
