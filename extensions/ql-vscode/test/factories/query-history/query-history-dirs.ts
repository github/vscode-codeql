import type { QueryHistoryDirs } from "../../../src/query-history/query-history-dirs";

export function createMockQueryHistoryDirs({
  localQueriesDirPath = "mock-local-queries-dir-path",
  variantAnalysesDirPath = "mock-variant-analyses-dir-path",
}: {
  localQueriesDirPath?: string;
  variantAnalysesDirPath?: string;
} = {}): QueryHistoryDirs {
  return {
    localQueriesDirPath,
    variantAnalysesDirPath,
  };
}
