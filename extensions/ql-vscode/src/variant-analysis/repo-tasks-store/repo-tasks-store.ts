import { outputJson, readJson } from "fs-extra";
import { join } from "path";
import type { VariantAnalysisRepositoryTask } from "../shared/variant-analysis";
import { mapRepoTaskToDto } from "./repo-tasks-dto-mapper";
import { mapRepoTaskToDomainModel } from "./repo-tasks-domain-mapper";

export const REPO_TASK_FILENAME = "repo_task.json";

export async function writeRepoTask(
  storageDirectory: string,
  repoTask: VariantAnalysisRepositoryTask,
): Promise<void> {
  const repoTaskData = mapRepoTaskToDto(repoTask);
  await outputJson(join(storageDirectory, REPO_TASK_FILENAME), repoTaskData);
}

export async function readRepoTask(
  storageDirectory: string,
): Promise<VariantAnalysisRepositoryTask> {
  const repoTaskData = await readJson(
    join(storageDirectory, REPO_TASK_FILENAME),
  );
  return mapRepoTaskToDomainModel(repoTaskData);
}
