import { availableParallelism } from "os";
import { UnzipProgressCallback, unzipToDirectory } from "./unzip";
import PQueue from "p-queue";

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
  progress?: UnzipProgressCallback,
): Promise<void> {
  const queue = new PQueue({
    concurrency: availableParallelism(),
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
