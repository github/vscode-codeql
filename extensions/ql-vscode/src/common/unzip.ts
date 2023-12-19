import { Entry as ZipEntry, open, Options as ZipOptions, ZipFile } from "yauzl";
import { Readable } from "stream";

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
