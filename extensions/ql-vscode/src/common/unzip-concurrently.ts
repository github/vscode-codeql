import { availableParallelism } from "os";
import PQueue from "p-queue";
import { openZip, ProgressCallback, readZipEntries, unzipFile } from "./unzip";

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
  progress?: ProgressCallback,
): Promise<void> {
  const zipFile = await openZip(archivePath, {
    autoClose: false,
    strictFileNames: true,
    lazyEntries: true,
  });

  try {
    const entries = await readZipEntries(zipFile);

    const queue = new PQueue({
      concurrency: availableParallelism(),
    });

    let filesExtracted = 0;
    const totalFiles = entries.length;
    let bytesExtracted = 0;
    const totalBytes = entries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0,
    );

    await queue.addAll(
      entries.map((entry) => async () => {
        const entryBytesExtracted = await unzipFile(
          zipFile,
          entry,
          destinationPath,
        );

        bytesExtracted += entryBytesExtracted;

        filesExtracted++;
        progress?.({
          filesExtracted,
          totalFiles,
          bytesExtracted,
          totalBytes,
        });
      }),
    );
  } finally {
    zipFile.close();
  }
}
