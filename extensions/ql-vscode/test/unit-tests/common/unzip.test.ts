import { resolve } from "path";
import {
  excludeDirectories,
  openZip,
  openZipBuffer,
  readZipEntries,
} from "../../../src/common/unzip";

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
