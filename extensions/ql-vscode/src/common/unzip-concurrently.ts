import { availableParallelism } from "os";
import type { UnzipProgressCallback } from "./unzip";
import { unzipToDirectory } from "./unzip";
import PQueue from "p-queue";

/**
 * Maximum number of files to extract concurrently. We cap this rather than
 * using the full core count so that we don't open an excessive number of
 * simultaneous file writes, which can overwhelm slower or contended storage
 * during extraction.
 */
const MAX_UNZIP_CONCURRENCY = 4;

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
  progress?: UnzipProgressCallback,
  timeoutSeconds?: number,
): Promise<void> {
  const queue = new PQueue({
    concurrency: Math.min(availableParallelism(), MAX_UNZIP_CONCURRENCY),
  });

  return unzipToDirectory(
    archivePath,
    destinationPath,
    progress,
    async (tasks) => {
      await queue.addAll(tasks);
    },
    timeoutSeconds,
  );
}
