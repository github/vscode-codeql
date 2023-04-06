import { outputJson, readJson } from "fs-extra";
import { join } from "path";
import { VariantAnalysisRepositoryTask } from "../shared/variant-analysis";

export const REPO_TASK_FILENAME = "repo_task.json";

export function writeRepoTask(
  storageDirectory: string,
  repoTask: VariantAnalysisRepositoryTask,
): Promise<void> {
  return outputJson(join(storageDirectory, REPO_TASK_FILENAME), repoTask);
}

export function readRepoTask(
  storageDirectory: string,
): Promise<VariantAnalysisRepositoryTask> {
  return readJson(join(storageDirectory, REPO_TASK_FILENAME));
}
