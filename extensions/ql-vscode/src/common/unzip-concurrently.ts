import { availableParallelism } from "os";
import { unzipToDirectory } from "./unzip";
import PQueue from "p-queue";

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
): Promise<void> {
  const queue = new PQueue({
    concurrency: availableParallelism(),
  });

  return unzipToDirectory(archivePath, destinationPath, async (tasks) => {
    await queue.addAll(tasks);
  });
}
