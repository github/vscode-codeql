import { Entry as ZipEntry, open, Options as ZipOptions, ZipFile } from "yauzl";
import { Readable } from "stream";
import { dirname, join } from "path";
import { WriteStream } from "fs";
import { createWriteStream, ensureDir } from "fs-extra";

// We can't use promisify because it picks up the wrong overload.
function openZip(path: string, options: ZipOptions = {}): Promise<ZipFile> {
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

function readZipEntries(zipFile: ZipFile): Promise<ZipEntry[]> {
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

export async function unzipToDirectory(
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

    for (const entry of entries) {
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
    }
  } finally {
    zipFile.close();
  }
}
