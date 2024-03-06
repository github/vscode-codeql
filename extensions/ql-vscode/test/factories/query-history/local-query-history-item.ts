import { faker } from "@faker-js/faker";
import type { InitialQueryInfo } from "../../../src/query-results";
import { LocalQueryInfo } from "../../../src/query-results";
import type {
  QueryEvaluationInfo,
  QueryWithResults,
} from "../../../src/run-queries-shared";
import { QueryOutputDir } from "../../../src/local-queries/query-output-dir";
import { CancellationTokenSource } from "vscode";
import type { QueryMetadata } from "../../../src/common/interface-types";
import type { QueryLanguage } from "../../../src/common/query-language";

export function createMockLocalQueryInfo({
  startTime = new Date(),
  resultCount = 0,
  userSpecifiedLabel = undefined,
  failureReason = undefined,
  dbName = "db-name",
  hasMetadata = false,
  queryWithResults = undefined,
  language = undefined,
  outputDir = new QueryOutputDir("/a/b/c"),
}: {
  startTime?: Date;
  resultCount?: number;
  userSpecifiedLabel?: string;
  failureReason?: string;
  dbName?: string;
  hasMetadata?: boolean;
  queryWithResults?: QueryWithResults | undefined;
  language?: QueryLanguage;
  outputDir?: QueryOutputDir | undefined;
}): LocalQueryInfo {
  const initialQueryInfo = {
    queryText: "select 1",
    isQuickQuery: false,
    isQuickEval: false,
    queryName: "query-name",
    queryPath: "query-file.ql",
    databaseInfo: {
      databaseUri: "databaseUri",
      name: dbName,
      language,
    },
    start: startTime,
    id: faker.number.int().toString(),
    userSpecifiedLabel,
    outputDir,
  } as InitialQueryInfo;

  const localQuery = new LocalQueryInfo(
    initialQueryInfo,
    new CancellationTokenSource(),
  );

  localQuery.failureReason = failureReason;
  localQuery.cancel = () => {
    /**/
  };

  if (queryWithResults) {
    localQuery.completeThisQuery(queryWithResults);
    localQuery.completedQuery?.setResultCount(1);
  } else if (resultCount > 0) {
    const queryWithResults = createMockQueryWithResults({ hasMetadata });
    localQuery.completeThisQuery(queryWithResults);
    localQuery.completedQuery?.setResultCount(resultCount);
  }

  return localQuery;
}

export function createMockQueryWithResults({
  didRunSuccessfully = true,
  hasInterpretedResults = true,
  hasMetadata = undefined,
}: {
  didRunSuccessfully?: boolean;
  hasInterpretedResults?: boolean;
  hasMetadata?: boolean;
}): QueryWithResults {
  const deleteQuery = jest.fn();
  const metadata = hasMetadata
    ? ({ name: "query-name" } as QueryMetadata)
    : undefined;

  return {
    query: {
      hasInterpretedResults: () => Promise.resolve(hasInterpretedResults),
      deleteQuery,
      metadata,
    } as unknown as QueryEvaluationInfo,
    successful: didRunSuccessfully,
    message: didRunSuccessfully
      ? "finished in 0 seconds"
      : "compilation failed: unknown error",
  };
}
