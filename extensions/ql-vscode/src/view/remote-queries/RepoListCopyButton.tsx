import * as React from "react";
import { vscode } from "../vscode-api";
import { RemoteQueryResult } from "../../remote-queries/shared/remote-query-result";
import { CopyIcon } from "@primer/octicons-react";
import { IconButton } from "@primer/react";

const copyRepositoryList = (queryResult: RemoteQueryResult) => {
  vscode.postMessage({
    t: "copyRepoList",
    queryId: queryResult.queryId,
  });
};

const RepoListCopyButton = ({
  queryResult,
}: {
  queryResult: RemoteQueryResult;
}) => (
  <IconButton
    aria-label="Copy repository list"
    icon={CopyIcon}
    variant="invisible"
    size="small"
    sx={{ "text-align": "right" }}
    onClick={() => copyRepositoryList(queryResult)}
  />
);

export default RepoListCopyButton;
