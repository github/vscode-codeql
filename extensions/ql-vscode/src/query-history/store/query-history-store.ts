import { pathExists, remove, mkdir, writeFile, readJson } from "fs-extra";
import { dirname } from "path";

import {
  asError,
  asyncFilter,
  getErrorMessage,
  getErrorStack,
} from "../../common/helpers-pure";
import type { QueryHistoryInfo } from "../query-history-info";
import { redactableError } from "../../common/errors";
import type { QueryHistoryDto, QueryHistoryItemDto } from "./query-history-dto";
import { mapQueryHistoryToDomainModel } from "./query-history-dto-mapper";
import { mapQueryHistoryToDto } from "./query-history-domain-mapper";
import { extLogger } from "../../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../../common/logging";
import { telemetryListener } from "../../common/vscode/telemetry";

const ALLOWED_QUERY_HISTORY_VERSIONS = [1, 2];

export async function readQueryHistoryFromFile(
  fsPath: string,
): Promise<QueryHistoryInfo[]> {
  try {
    if (!(await pathExists(fsPath))) {
      return [];
    }

    const obj: QueryHistoryDto = await readJson(fsPath, {
      encoding: "utf8",
    });

    if (!ALLOWED_QUERY_HISTORY_VERSIONS.includes(obj.version)) {
      void showAndLogExceptionWithTelemetry(
        extLogger,
        telemetryListener,
        redactableError`Can't parse query history. Unsupported query history format: v${obj.version}.`,
      );
      return [];
    }

    const queries = obj.queries;
    // Remove remote queries, which are not supported anymore.
    const parsedQueries = queries.filter(
      (q: QueryHistoryItemDto | { t: "remote" }) => q.t !== "remote",
    );

    // Map the data models to the domain models.
    const domainModels: QueryHistoryInfo[] =
      mapQueryHistoryToDomainModel(parsedQueries);

    // Filter out queries that have been deleted on disk
    // most likely another workspace has deleted them because the
    // queries aged out.
    const filteredDomainModels: Promise<QueryHistoryInfo[]> = asyncFilter(
      domainModels,
      async (q) => {
        if (q.t === "variant-analysis") {
          // The query history store doesn't know where variant analysises are
          // stored so we need to assume here that they exist. We check later
          // to see if they exist on disk.
          return true;
        }
        const resultsPath = q.completedQuery?.query.resultsPaths.resultsPath;
        return !!resultsPath && (await pathExists(resultsPath));
      },
    );

    return filteredDomainModels;
  } catch (e) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError(asError(e))`Error loading query history.`,
      {
        fullMessage: `Error loading query history.\n${getErrorStack(e)}`,
      },
    );
    // Since the query history is invalid, it should be deleted so this error does not happen on next startup.
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
    // Remove incomplete local queries since they cannot be recreated on restart
    const filteredQueries = queries.filter((q) =>
      q.t === "local" ? q.completedQuery !== undefined : true,
    );

    // Map domain model queries to data model
    const queryHistoryData = mapQueryHistoryToDto(filteredQueries);

    const data = JSON.stringify(
      {
        // version 2:
        // - adds the `variant-analysis` type
        // - ensures a `successful` property exists on completedQuery
        version: 2,
        queries: queryHistoryData,
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
