import { Entry as ZipEntry, open, Options as ZipOptions, ZipFile } from "yauzl";
import { Readable, Transform } from "stream";
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
      if (/\/$/.test(entry.fileName)) {
        // Directory file names end with '/'
        // We don't need to do anything for directories.
      } else {
        files.push(entry);
      }

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

export function openZipReadStream(
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
  bytesExtractedCallback?: (bytesExtracted: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    readable.on("error", (err) => {
      reject(err);
    });
    readable.on("end", () => {
      resolve();
    });

    readable
      .pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            bytesExtractedCallback?.(chunk.length);
            this.push(chunk);
            callback();
          },
        }),
      )
      .pipe(writeStream);
  });
}

export type Progress = {
  filesExtracted: number;
  totalFiles: number;

  bytesExtracted: number;
  totalBytes: number;
};

export type ProgressCallback = (progress: Progress) => void;

/**
 * Unzips a single file from a zip archive.
 *
 * @param zipFile
 * @param entry
 * @param rootDestinationPath
 * @param bytesExtractedCallback Called when bytes are extracted.
 * @return The number of bytes extracted.
 */
export async function unzipFile(
  zipFile: ZipFile,
  entry: ZipEntry,
  rootDestinationPath: string,
  bytesExtractedCallback?: (bytesExtracted: number) => void,
): Promise<number> {
  const path = join(rootDestinationPath, entry.fileName);

  if (/\/$/.test(entry.fileName)) {
    // Directory file names end with '/'

    await ensureDir(path);

    return 0;
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

    await copyStream(readable, writeStream, bytesExtractedCallback);

    return entry.uncompressedSize;
  }
}

/**
 * Sequentially unzips all files from a zip archive. Please use
 * `unzipToDirectoryConcurrently` if you can. This function is only
 * provided because Jest cannot import `p-queue`.
 *
 * @param archivePath
 * @param destinationPath
 * @param progress
 */
export async function unzipToDirectorySequential(
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

    let filesExtracted = 0;
    const totalFiles = entries.length;
    let bytesExtracted = 0;
    const totalBytes = entries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0,
    );

    const reportProgress = () => {
      progress?.({
        filesExtracted,
        totalFiles,
        bytesExtracted,
        totalBytes,
      });
    };

    for (const entry of entries) {
      let entryBytesExtracted = 0;

      const totalEntryBytesExtracted = await unzipFile(
        zipFile,
        entry,
        destinationPath,
        (thisBytesExtracted) => {
          entryBytesExtracted += thisBytesExtracted;
          bytesExtracted += thisBytesExtracted;
          reportProgress();
        },
      );

      // Should be 0, but just in case.
      bytesExtracted += -entryBytesExtracted + totalEntryBytesExtracted;

      filesExtracted++;
      reportProgress();
    }
  } finally {
    zipFile.close();
  }
}
