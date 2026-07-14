import { availableParallelism } from "os";
import type { UnzipProgressCallback } from "./unzip";
import { unzipToDirectory } from "./unzip";
import PQueue from "p-queue";

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
  progress?: UnzipProgressCallback,
): Promise<void> {
  const queue = new PQueue({
    concurrency: Math.min(availableParallelism(), 4),
  });

  return unzipToDirectory(
    archivePath,
    destinationPath,
    progress,
    async (tasks) => {
      await queue.addAll(tasks);
    },
  );
}
