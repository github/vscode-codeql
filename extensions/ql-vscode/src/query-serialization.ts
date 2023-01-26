import { pathExists, readFile, remove, mkdir, writeFile } from "fs-extra";
import { dirname } from "path";

import { showAndLogErrorMessage } from "./helpers";
import {
  asyncFilter,
  getErrorMessage,
  getErrorStack,
} from "./pure/helpers-pure";
import { CompletedQueryInfo, LocalQueryInfo } from "./query-results";
import { QueryHistoryInfo } from "./query-history/query-history-info";
import { QueryStatus } from "./query-status";
import { QueryEvaluationInfo } from "./run-queries-shared";
import { QueryResultType } from "./pure/legacy-messages";
import { JsonValidator } from "./data-serialization/json-validator";
import { RemoteQueryHistoryItem } from "./data-serialization/source-schemas-types/remote-query-history-item";
import { VariantAnalysisHistoryItem } from "./data-serialization/source-schemas-types/variant-analysis-history-item";

type SerializableHistoryItems =
  | LocalQueryInfo
  | RemoteQueryHistoryItem
  | VariantAnalysisHistoryItem;

export async function deserializeQueryHistory(
  fsPath: string,
): Promise<SerializableHistoryItems[]> {
  try {
    if (!(await pathExists(fsPath))) {
      return [];
    }

    const jsonValidator = new JsonValidator();

    const data = await readFile(fsPath, "utf8");
    const obj = JSON.parse(data);
    if (![1, 2].includes(obj.version)) {
      void showAndLogErrorMessage(
        `Can't parse query history. Unsupported query history format: v${obj.version}. `,
      );
      return [];
    }

    const queries = obj.queries;
    const parsedQueries = queries.map((q: SerializableHistoryItems) => {
      // Need to explicitly set prototype since reading in from JSON will not
      // do this automatically. Note that we can't call the constructor here since
      // the constructor invokes extra logic that we don't want to do.
      if (q.t === "local") {
        Object.setPrototypeOf(q, LocalQueryInfo.prototype);

        // Date instances are serialized as strings. Need to
        // convert them back to Date instances.
        (q.initialInfo as any).start = new Date(q.initialInfo.start);
        if (q.completedQuery) {
          // Again, need to explicitly set prototypes.
          Object.setPrototypeOf(q.completedQuery, CompletedQueryInfo.prototype);
          Object.setPrototypeOf(
            q.completedQuery.query,
            QueryEvaluationInfo.prototype,
          );
          // deserialized queries do not need to be disposed
          q.completedQuery.dispose = () => {
            /**/
          };

          // Previously, there was a typo in the completedQuery type. There was a field
          // `sucessful` and it was renamed to `successful`. We need to handle this case.
          if ("sucessful" in q.completedQuery) {
            (q.completedQuery as any).successful = (
              q.completedQuery as any
            ).sucessful;
            delete (q.completedQuery as any).sucessful;
          }

          if (!("successful" in q.completedQuery)) {
            (q.completedQuery as any).successful =
              q.completedQuery.result?.resultType === QueryResultType.SUCCESS;
          }
        }
      } else if (q.t === "remote") {
        // A bug was introduced that didn't set the completed flag in query history
        // items. The following code makes sure that the flag is set in order to
        // "patch" older query history items.
        if (q.status === QueryStatus.Completed) {
          q.completed = true;
        }

        return jsonValidator.validate(q, "RemoteQueryHistoryItem");
      } else if (q.t === "variant-analysis") {
        return jsonValidator.validate(q, "VariantAnalysisHistoryItem");
      }

      return q;
    });

    // filter out queries that have been deleted on disk
    // most likely another workspace has deleted them because the
    // queries aged out.
    return asyncFilter(parsedQueries, async (q) => {
      if (q.t === "remote" || q.t === "variant-analysis") {
        // the deserializer doesn't know where the remote queries are stored
        // so we need to assume here that they exist. Later, we check to
        // see if they exist on disk.
        return true;
      }
      const resultsPath = q.completedQuery?.query.resultsPaths.resultsPath;
      return !!resultsPath && (await pathExists(resultsPath));
    });
  } catch (e) {
    void showAndLogErrorMessage("Error loading query history.", {
      fullMessage: ["Error loading query history.", getErrorStack(e)].join(
        "\n",
      ),
    });
    // since the query history is invalid, it should be deleted so this error does not happen on next startup.
    await remove(fsPath);
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
export async function serializeQueryHistory(
  queries: QueryHistoryInfo[],
  fsPath: string,
): Promise<void> {
  try {
    if (!(await pathExists(fsPath))) {
      await mkdir(dirname(fsPath), { recursive: true });
    }

    // remove incomplete local queries since they cannot be recreated on restart
    const filteredQueries = queries.filter((q) =>
      q.t === "local" ? q.completedQuery !== undefined : true,
    );

    const jsonValidator = new JsonValidator();

    const finalQueries = filteredQueries.map((q) => {
      if (q.t == "remote") {
        return jsonValidator.validate(q, "RemoteQueryHistoryItem");
      } else if (q.t == "variant-analysis") {
        return jsonValidator.validate(q, "VariantAnalysisHistoryItem");
      }
      return q;
    });

    const data = JSON.stringify(
      {
        // version 2:
        // - adds the `variant-analysis` type
        // - ensures a `successful` property exists on completedQuery
        version: 2,
        queries: finalQueries,
      },
      null,
      2,
    );
    await writeFile(fsPath, data);
  } catch (e) {
    throw new Error(
      `Error saving query history to ${fsPath}: ${getErrorMessage(e)}`,
    );
  }
}
