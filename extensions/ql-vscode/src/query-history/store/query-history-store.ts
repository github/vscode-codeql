import { pathExists, remove, mkdir, writeFile, readJson } from "fs-extra";
import { dirname } from "path";

import { showAndLogExceptionWithTelemetry } from "../../helpers";
import {
  asError,
  asyncFilter,
  getErrorMessage,
  getErrorStack,
} from "../../pure/helpers-pure";
import { CompletedQueryInfo, LocalQueryInfo } from "../../query-results";
import { QueryHistoryInfo } from "../query-history-info";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryResultType } from "../../pure/legacy-messages";
import { redactableError } from "../../pure/errors";
import {
  ALLOWED_QUERY_HISTORY_VERSIONS,
  QueryHistoryData,
  QueryHistoryDataItem,
} from "./query-history-data";
import { VariantAnalysisHistoryItem } from "../variant-analysis-history-item";
import { mapLocalQueryHistoryItemDataModelToDomainModel } from "./query-history-item-mapper";

// readFromQueryHistoryFile
//  - read from file (as data models)
//  - map it to the domain model
//  - return the domain model

export async function readQueryHistoryFromFile(
  fsPath: string,
): Promise<QueryHistoryInfo[]> {
  try {
    if (!(await pathExists(fsPath))) {
      return [];
    }

    const obj: QueryHistoryData = await readJson(fsPath, {
      encoding: "utf8",
    });

    if (!ALLOWED_QUERY_HISTORY_VERSIONS.includes(obj.version)) {
      void showAndLogExceptionWithTelemetry(
        redactableError`Can't parse query history. Unsupported query history format: v${obj.version}.`,
      );
      return [];
    }

    const queries = obj.queries;
    // Remove remote queries, which are not supported anymore.
    const parsedQueries = queries
      .filter((q: QueryHistoryDataItem | { t: "remote" }) => q.t !== "remote")
      .map((q: QueryHistoryDataItem) => {
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
            Object.setPrototypeOf(
              q.completedQuery,
              CompletedQueryInfo.prototype,
            );
            Object.setPrototypeOf(
              q.completedQuery.query,
              QueryEvaluationInfo.prototype,
            );

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
        }
        return q;
      });

    // filter out queries that have been deleted on disk
    // most likely another workspace has deleted them because the
    // queries aged out.
    const dataModels: Promise<QueryHistoryDataItem[]> = asyncFilter(
      parsedQueries,
      async (q) => {
        if (q.t === "variant-analysis") {
          // the deserializer doesn't know where the remote queries are stored
          // so we need to assume here that they exist. Later, we check to
          // see if they exist on disk.
          return true;
        }
        // TMP NOTE: removed one 'resultsPath' when introducing data model
        const resultsPath = q.completedQuery?.query.resultsPaths;
        return !!resultsPath && (await pathExists(resultsPath));
      },
    );

    // TODO: Map to domain models
    const actualDataModels = await dataModels;
    const domainModels: QueryHistoryInfo[] = actualDataModels.map((d) => {
      if (d.t === "variant-analysis") {
        const query: VariantAnalysisHistoryItem = d;
        return query;
      } else if (d.t === "local") {
        return mapLocalQueryHistoryItemDataModelToDomainModel(d);
      }

      throw Error("xx");
    });

    return domainModels;
  } catch (e) {
    void showAndLogExceptionWithTelemetry(
      redactableError(asError(e))`Error loading query history.`,
      {
        fullMessage: `Error loading query history.\n${getErrorStack(e)}`,
      },
    );
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
export async function writeQueryHistoryToFile(
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
    const data = JSON.stringify(
      {
        // version 2:
        // - adds the `variant-analysis` type
        // - ensures a `successful` property exists on completedQuery
        version: 2,
        queries: filteredQueries,
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
