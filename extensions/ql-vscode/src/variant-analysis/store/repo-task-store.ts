import { outputJson, readJson } from "fs-extra";
import { join } from "path";
import { VariantAnalysisRepositoryTask } from "../shared/variant-analysis";
import { mapRepoTaskToData } from "./repo-task-to-data-mapper";
import { mapRepoTaskToDomain } from "./repo-task-to-domain-mapper";

export const REPO_TASK_FILENAME = "repo_task.json";

export async function writeRepoTask(
  storageDirectory: string,
  repoTask: VariantAnalysisRepositoryTask,
): Promise<void> {
  const repoTaskData = mapRepoTaskToData(repoTask);
  await outputJson(join(storageDirectory, REPO_TASK_FILENAME), repoTaskData);
}

export async function readRepoTask(
  storageDirectory: string,
): Promise<VariantAnalysisRepositoryTask> {
  const repoTaskData = await readJson(
    join(storageDirectory, REPO_TASK_FILENAME),
  );
  return mapRepoTaskToDomain(repoTaskData);
}
