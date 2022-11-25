import * as fs from "fs-extra";
import { Repository as RemoteRepository } from "./repository";
import { QueryMetadata } from "../pure/interface-types";
import { getQueryName } from "./run-remote-query";
import { Repository } from "./shared/repository";

export interface RemoteQuery {
  queryName: string;
  queryFilePath: string;
  queryText: string;
  language: string;
  controllerRepository: RemoteRepository;
  executionStartTime: number; // Use number here since it needs to be serialized and desserialized.
  actionsWorkflowRunId: number;
  repositoryCount: number;
}

export async function buildRemoteQueryEntity(
  queryFilePath: string,
  queryMetadata: QueryMetadata | undefined,
  controllerRepo: Repository,
  queryStartTime: number,
  workflowRunId: number,
  language: string,
  repositoryCount: number,
): Promise<RemoteQuery> {
  const queryName = getQueryName(queryMetadata, queryFilePath);
  const queryText = await fs.readFile(queryFilePath, "utf8");
  const [owner, name] = controllerRepo.fullName.split("/");

  return {
    queryName,
    queryFilePath,
    queryText,
    language,
    controllerRepository: {
      owner,
      name,
    },
    executionStartTime: queryStartTime,
    actionsWorkflowRunId: workflowRunId,
    repositoryCount,
  };
}
