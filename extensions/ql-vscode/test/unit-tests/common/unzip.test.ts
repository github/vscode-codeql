import { createHash } from "crypto";
import { open } from "fs/promises";
import { join, relative, resolve, sep } from "path";
import { chmod, pathExists, readdir } from "fs-extra";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import {
  excludeDirectories,
  openZip,
  openZipBuffer,
  readZipEntries,
  unzipToDirectorySequentially,
} from "../../../src/common/unzip";
import { walkDirectory } from "../../../src/common/files";
import { unzipToDirectoryConcurrently } from "../../../src/common/unzip-concurrently";

const zipPath = resolve(__dirname, "../data/unzip/test-zip.zip");

describe("openZip", () => {
  it("can open a zip file", async () => {
    const zipFile = await openZip(zipPath, {
      lazyEntries: false,
    });

    expect(zipFile.entryCount).toEqual(11);
  });
});

describe("readZipEntries", () => {
  it("can read the entries when there are multiple directories", async () => {
    const zipFile = await openZip(zipPath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);

    expect(entries.map((entry) => entry.fileName).sort()).toEqual([
      "directory/",
      "directory/file.txt",
      "directory/file2.txt",
      "directory2/",
      "directory2/file.txt",
      "empty-directory/",
      "tools/",
      "tools/osx64/",
      "tools/osx64/java-aarch64/",
      "tools/osx64/java-aarch64/bin/",
      "tools/osx64/java-aarch64/bin/java",
    ]);
  });
});

describe("excludeDirectories", () => {
  it("excludes directories", async () => {
    const zipFile = await openZip(zipPath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);
    const entriesWithoutDirectories = excludeDirectories(entries);

    expect(
      entriesWithoutDirectories.map((entry) => entry.fileName).sort(),
    ).toEqual([
      "directory/file.txt",
      "directory/file2.txt",
      "directory2/file.txt",
      "tools/osx64/java-aarch64/bin/java",
    ]);
  });
});

describe("openZipBuffer", () => {
  it("can read an entry in the zip file", async () => {
    const zipFile = await openZip(zipPath, {
      lazyEntries: true,
      autoClose: false,
    });
    const entries = await readZipEntries(zipFile);

    const entry = entries.find(
      (entry) => entry.fileName === "directory/file.txt",
    );
    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }

    const buffer = await openZipBuffer(zipFile, entry);
    expect(buffer).toHaveLength(13);
    expect(buffer.toString("utf8")).toEqual("I am a file\n\n");
  });
});

describe.each([
  {
    name: "unzipToDirectorySequentially",
    unzipToDirectory: unzipToDirectorySequentially,
  },
  {
    name: "unzipToDirectoryConcurrently",
    unzipToDirectory: unzipToDirectoryConcurrently,
  },
])("$name", ({ unzipToDirectory }) => {
  let tmpDir: DirectoryResult;

  beforeEach(async () => {
    tmpDir = await dir({
      unsafeCleanup: true,
    });
  });

  afterEach(async () => {
    for await (const file of walkDirectory(tmpDir.path)) {
      await chmod(file, 0o777);
    }

    await tmpDir?.cleanup();
  });

  it("extracts all files", async () => {
    await unzipToDirectory(zipPath, tmpDir.path);

    const allFiles = [];
    for await (const file of walkDirectory(tmpDir.path, true)) {
      allFiles.push(file);
    }

    expect(
      allFiles
        .map((filePath) => relative(tmpDir.path, filePath).split(sep).join("/"))
        .sort(),
    ).toEqual([
      "directory",
      "directory/file.txt",
      "directory/file2.txt",
      "directory2",
      "directory2/file.txt",
      "empty-directory",
      "tools",
      "tools/osx64",
      "tools/osx64/java-aarch64",
      "tools/osx64/java-aarch64/bin",
      "tools/osx64/java-aarch64/bin/java",
    ]);

    await expectFile(join(tmpDir.path, "directory", "file.txt"), {
      mode: 0o100644,
      contents: "I am a file\n\n",
    });
    await expectFile(join(tmpDir.path, "directory", "file2.txt"), {
      mode: 0o100644,
      contents: "I am another file\n\n",
    });
    await expectFile(join(tmpDir.path, "directory2", "file.txt"), {
      mode: 0o100600,
      contents: "I am secret\n",
    });
    await expectFile(
      join(tmpDir.path, "tools", "osx64", "java-aarch64", "bin", "java"),
      {
        mode: 0o100755,
        hash: "68b832b5c0397c5baddbbb0a76cf5407b7ea5eee8f84f9ab9488f04a52e529eb",
      },
    );

    expect(await pathExists(join(tmpDir.path, "empty-directory"))).toBe(true);
    expect(await readdir(join(tmpDir.path, "empty-directory"))).toEqual([]);
  });

  describe("with reported progress", () => {
    const progressCallback = jest.fn();

    beforeEach(async () => {
      progressCallback.mockReset();

      await unzipToDirectory(zipPath, tmpDir.path, progressCallback);
    });

    it("has at least as many progress callbacks as files", () => {
      expect(progressCallback.mock.calls.length).toBeGreaterThanOrEqual(11);
    });

    it("has an incrementing files extracted value", () => {
      let previousValue = 0;
      for (const call of progressCallback.mock.calls.values()) {
        const [{ filesExtracted }] = call;
        expect(filesExtracted).toBeGreaterThanOrEqual(previousValue);
        previousValue = filesExtracted;
      }
    });

    it("has an incrementing bytes extracted value", () => {
      let previousValue = 0;
      for (const call of progressCallback.mock.calls.values()) {
        const [{ bytesExtracted }] = call;
        expect(bytesExtracted).toBeGreaterThanOrEqual(previousValue);
        previousValue = bytesExtracted;
      }
    });

    it("always increments either bytes or files extracted", () => {
      let previousBytesExtracted = 0;
      let previousFilesExtracted = 0;

      for (const [index, call] of progressCallback.mock.calls.entries()) {
        if (index === 0) {
          // The first call is always 0, 0
          continue;
        }

        const [{ bytesExtracted, filesExtracted }] = call;
        expect(bytesExtracted + filesExtracted).toBeGreaterThan(
          previousBytesExtracted + previousFilesExtracted,
        );
        previousBytesExtracted = bytesExtracted;
        previousFilesExtracted = filesExtracted;
      }
    });

    it("has a first call with the correct values", () => {
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        bytesExtracted: 0,
        totalBytes: 87,
        filesExtracted: 0,
        totalFiles: 11,
      });
    });

    it("has a last call with the correct values", () => {
      expect(progressCallback).toHaveBeenLastCalledWith({
        bytesExtracted: 87,
        totalBytes: 87,
        filesExtracted: 11,
        totalFiles: 11,
      });
    });
  });
});

async function expectFile(
  filePath: string,
  {
    mode: expectedMode,
    hash: expectedHash,
    contents: expectedContents,
  }: {
    mode: number;
    hash?: string;
    contents?: string;
  },
) {
  const file = await open(filePath, "r");

  // Windows doesn't really support file modes
  if (process.platform !== "win32") {
    const stats = await file.stat();
    expect(stats.mode).toEqual(expectedMode);
  }

  const contents = await file.readFile();

  if (expectedHash) {
    const hash = await computeHash(contents);
    expect(hash).toEqual(expectedHash);
  }

  if (expectedContents) {
    expect(contents.toString("utf-8")).toEqual(expectedContents);
  }

  await file.close();
}

async function computeHash(contents: Buffer) {
  const hash = createHash("sha256");
  hash.update(contents);

  return hash.digest("hex");
}
