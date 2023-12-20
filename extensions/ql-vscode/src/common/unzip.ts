import { Entry as ZipEntry, open, Options as ZipOptions, ZipFile } from "yauzl";
import { Readable } from "stream";
import { dirname, join } from "path";
import { WriteStream } from "fs";
import { createWriteStream, ensureDir } from "fs-extra";

// We can't use promisify because it picks up the wrong overload.
export function openZip(
  path: string,
  options: ZipOptions = {},
): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    open(path, options, (err, zipFile) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(zipFile);
    });
  });
}

export function excludeDirectories(entries: ZipEntry[]): ZipEntry[] {
  return entries.filter((entry) => !/\/$/.test(entry.fileName));
}

export function readZipEntries(zipFile: ZipFile): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    const files: ZipEntry[] = [];

    zipFile.readEntry();
    zipFile.on("entry", (entry: ZipEntry) => {
      files.push(entry);

      zipFile.readEntry();
    });

    zipFile.on("end", () => {
      resolve(files);
    });

    zipFile.on("error", (err) => {
      reject(err);
    });
  });
}

function openZipReadStream(
  zipFile: ZipFile,
  entry: ZipEntry,
): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (err, readStream) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(readStream);
    });
  });
}

export async function openZipBuffer(
  zipFile: ZipFile,
  entry: ZipEntry,
): Promise<Buffer> {
  const readable = await openZipReadStream(zipFile, entry);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk) => {
      chunks.push(chunk);
    });
    readable.on("error", (err) => {
      reject(err);
    });
    readable.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

async function copyStream(
  readable: Readable,
  writeStream: WriteStream,
): Promise<void> {
  return new Promise((resolve, reject) => {
    readable.on("error", (err) => {
      reject(err);
    });
    readable.on("end", () => {
      resolve();
    });

    readable.pipe(writeStream);
  });
}

/**
 * Unzips a single file from a zip archive.
 *
 * @param zipFile
 * @param entry
 * @param rootDestinationPath
 */
async function unzipFile(
  zipFile: ZipFile,
  entry: ZipEntry,
  rootDestinationPath: string,
): Promise<void> {
  const path = join(rootDestinationPath, entry.fileName);

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
}

/**
 * Unzips all files from a zip archive. Please use
 * `unzipToDirectoryConcurrently` or `unzipToDirectorySequentially` instead
 * of this function.
 *
 * @param archivePath
 * @param destinationPath
 * @param taskRunner A function that runs the tasks (either sequentially or concurrently).
 */
export async function unzipToDirectory(
  archivePath: string,
  destinationPath: string,
  taskRunner: (tasks: Array<() => Promise<void>>) => Promise<void>,
): Promise<void> {
  const zipFile = await openZip(archivePath, {
    autoClose: false,
    strictFileNames: true,
    lazyEntries: true,
  });

  try {
    const entries = await readZipEntries(zipFile);

    await taskRunner(
      entries.map((entry) => () => unzipFile(zipFile, entry, destinationPath)),
    );
  } finally {
    zipFile.close();
  }
}

/**
 * Sequentially unzips all files from a zip archive. Please use
 * `unzipToDirectoryConcurrently` if you can. This function is only
 * provided because Jest cannot import `p-queue`.
 *
 * @param archivePath
 * @param destinationPath
 */
export async function unzipToDirectorySequentially(
  archivePath: string,
  destinationPath: string,
): Promise<void> {
  return unzipToDirectory(archivePath, destinationPath, async (tasks) => {
    for (const task of tasks) {
      await task();
    }
  });
}
