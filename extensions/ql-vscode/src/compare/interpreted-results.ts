import { Uri } from "vscode";
import * as sarif from "sarif";
import { pathExists } from "fs-extra";
import { sarifParser } from "../common/sarif-parser";
import { CompletedLocalQueryInfo } from "../query-results";
import { DatabaseManager } from "../databases/local-databases";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { InterpretedQueryCompareResult } from "../common/interface-types";

import { sarifDiff } from "./sarif-diff";

async function getInterpretedResults(
  interpretedResultsPath: string,
): Promise<sarif.Log | undefined> {
  if (!(await pathExists(interpretedResultsPath))) {
    return undefined;
  }

  return await sarifParser(interpretedResultsPath);
}

export async function compareInterpretedResults(
  databaseManager: DatabaseManager,
  cliServer: CodeQLCliServer,
  fromQuery: CompletedLocalQueryInfo,
  toQuery: CompletedLocalQueryInfo,
): Promise<InterpretedQueryCompareResult> {
  const fromResultSet = await getInterpretedResults(
    fromQuery.completedQuery.query.resultsPaths.interpretedResultsPath,
  );

  const toResultSet = await getInterpretedResults(
    toQuery.completedQuery.query.resultsPaths.interpretedResultsPath,
  );

  if (!fromResultSet || !toResultSet) {
    throw new Error(
      "Could not find interpreted results for one or both queries.",
    );
  }

  const database = databaseManager.findDatabaseItem(
    Uri.parse(toQuery.initialInfo.databaseInfo.databaseUri),
  );
  if (!database) {
    throw new Error(
      "Could not find database the queries. Please check that the database still exists.",
    );
  }

  const sourceLocationPrefix = await database.getSourceLocationPrefix(
    cliServer,
  );

  const fromResults = fromResultSet.runs[0].results;
  const toResults = toResultSet.runs[0].results;

  if (!fromResults) {
    throw new Error("No results found in the 'from' query.");
  }

  if (!toResults) {
    throw new Error("No results found in the 'to' query.");
  }

  const { from, to } = sarifDiff(fromResults, toResults);

  return {
    kind: "interpreted",
    sourceLocationPrefix,
    from,
    to,
  };
}
