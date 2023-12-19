import { availableParallelism } from "os";
import { dirname, join } from "path";
import { createWriteStream, ensureDir } from "fs-extra";
import {
  copyStream,
  openZip,
  openZipReadStream,
  readZipEntries,
} from "./unzip";
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
        const path = join(destinationPath, entry.fileName);

        if (/\/$/.test(entry.fileName)) {
          // Directory file names end with '/'

          await ensureDir(path);
        } else {
          // Ensure the directory exists
          await ensureDir(dirname(path));

          const readable = await openZipReadStream(zipFile, entry);

          let mode: number | undefined = entry.externalFileAttributes >>> 16;
          if (mode <= 0) {
            mode = undefined;
          }

          const writeStream = createWriteStream(path, {
            autoClose: true,
            mode,
          });

          await copyStream(readable, writeStream);
        }
      }),
    );
  } finally {
    zipFile.close();
  }
}
