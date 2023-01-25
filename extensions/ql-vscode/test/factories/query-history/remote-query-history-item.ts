import { nanoid } from "nanoid";
import { RemoteQueryHistoryItem } from "../../../src/remote-queries/remote-query-history-item";
import { QueryStatus } from "../../../src/query-status";

export function createMockRemoteQueryHistoryItem({
  date = new Date("2022-01-01T00:00:00.000Z"),
  status = QueryStatus.InProgress,
  failureReason = undefined,
  resultCount = undefined,
  repositoryCount = 0,
  executionStartTime = date.getTime(),
  userSpecifiedLabel = undefined,
}: {
  date?: Date;
  status?: QueryStatus;
  failureReason?: string;
  resultCount?: number;
  repositoryCount?: number;
  repositories?: string[];
  executionStartTime?: number;
  userSpecifiedLabel?: string;
}): RemoteQueryHistoryItem {
  return {
    t: "remote",
    failureReason,
    resultCount,
    status,
    completed: false,
    queryId: nanoid(),
    remoteQuery: {
      queryName: "query-name",
      queryFilePath: "query-file.ql",
      queryText: "select 1",
      language: "javascript",
      controllerRepository: {
        owner: "github",
        name: "vscode-codeql-integration-tests",
      },
      executionStartTime,
      actionsWorkflowRunId: 1,
      repositoryCount,
    },
    userSpecifiedLabel,
  };
}
