import { Uri } from "vscode";
import { join } from "path";
import type { DatabaseManager } from "../databases/local-databases";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import {
  ALERTS_TABLE_NAME,
  SELECT_TABLE_NAME,
  type InterpretedQueryCompareResult,
} from "../common/interface-types";

import { getComparableSchemas, ComparePair } from "./compare-view";

export async function compareInterpretedResults(
  databaseManager: DatabaseManager,
  cliServer: CodeQLCliServer,
  comparePair: ComparePair,
): Promise<InterpretedQueryCompareResult> {
  const { from: fromQuery, fromInfo, to: toQuery, toInfo } = comparePair;

  // `ALERTS_TABLE_NAME` is inserted by `getResultSetNames` into the schema
  // names even if it does not occur as a result set. Hence we check for
  // `SELECT_TABLE_NAME` first, and use that if it exists.
  const tableName = fromInfo.schemaNames.includes(SELECT_TABLE_NAME)
    ? SELECT_TABLE_NAME
    : ALERTS_TABLE_NAME;

  getComparableSchemas(fromInfo, toInfo, tableName, tableName);

  const database = databaseManager.findDatabaseItem(
    Uri.parse(toQuery.initialInfo.databaseInfo.databaseUri),
  );
  if (!database) {
    throw new Error(
      "Could not find database the queries. Please check that the database still exists.",
    );
  }

  const { uniquePath1, uniquePath2, path, cleanup } = await cliServer.bqrsDiff(
    fromQuery.completedQuery.query.resultsPath,
    toQuery.completedQuery.query.resultsPath,
    { retainResultSets: ["nodes", "edges", "subpaths"] },
  );
  try {
    const sarifOutput1 = join(path, "from.sarif");
    const sarifOutput2 = join(path, "to.sarif");

    const sourceLocationPrefix =
      await database.getSourceLocationPrefix(cliServer);
    const sourceArchiveUri = database.sourceArchive;
    const sourceInfo =
      sourceArchiveUri === undefined
        ? undefined
        : {
            sourceArchive: sourceArchiveUri.fsPath,
            sourceLocationPrefix,
          };

    const fromResultSet = await cliServer.interpretBqrsSarif(
      fromQuery.completedQuery.query.metadata!,
      uniquePath1,
      sarifOutput1,
      sourceInfo,
    );
    const toResultSet = await cliServer.interpretBqrsSarif(
      toQuery.completedQuery.query.metadata!,
      uniquePath2,
      sarifOutput2,
      sourceInfo,
    );

    return {
      kind: "interpreted",
      sourceLocationPrefix,
      from: fromResultSet.runs[0].results!,
      to: toResultSet.runs[0].results!,
    };
  } finally {
    await cleanup();
  }
}
