import { availableParallelism } from "os";
import { openZip, readZipEntries, unzipFile } from "./unzip";
import PQueue from "p-queue";

export async function unzipToDirectoryConcurrently(
  archivePath: string,
  destinationPath: string,
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

    await queue.addAll(
      entries.map((entry) => async () => {
        await unzipFile(zipFile, entry, destinationPath);
      }),
    );
  } finally {
    zipFile.close();
  }
}
