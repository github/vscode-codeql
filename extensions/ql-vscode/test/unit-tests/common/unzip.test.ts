import { resolve } from "path";
import {
  excludeDirectories,
  openZip,
  openZipBuffer,
  readZipEntries,
} from "../../../src/common/unzip";

const zipWithSingleFilePath = resolve(
  __dirname,
  "../../vscode-tests/no-workspace/data/archive-filesystem-provider-test/single_file.zip",
);
const zipWithFolderPath = resolve(
  __dirname,
  "../../vscode-tests/no-workspace/data/archive-filesystem-provider-test/zip_with_folder.zip",
);

describe("openZip", () => {
  it("can open a zip file", async () => {
    const zipFile = await openZip(zipWithFolderPath, {
      lazyEntries: false,
    });

    expect(zipFile.entryCount).toEqual(8);
  });
});

describe("readZipEntries", () => {
  it("can read the entries when there is a single file", async () => {
    const zipFile = await openZip(zipWithSingleFilePath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);

    expect(entries.map((entry) => entry.fileName).sort()).toEqual([
      "src_archive/",
      "src_archive/aFileName.txt",
    ]);
  });

  it("can read the entries when there are multiple folders", async () => {
    const zipFile = await openZip(zipWithFolderPath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);

    expect(entries.map((entry) => entry.fileName).sort()).toEqual([
      "__MACOSX/._folder1",
      "__MACOSX/folder1/._textFile.txt",
      "__MACOSX/folder1/._textFile2.txt",
      "folder1/",
      "folder1/folder2/",
      "folder1/folder2/textFile3.txt",
      "folder1/textFile.txt",
      "folder1/textFile2.txt",
    ]);
  });
});

describe("excludeDirectories", () => {
  it("excludes directories when there is a single file", async () => {
    const zipFile = await openZip(zipWithSingleFilePath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);
    const entriesWithoutDirectories = excludeDirectories(entries);

    expect(
      entriesWithoutDirectories.map((entry) => entry.fileName).sort(),
    ).toEqual(["src_archive/aFileName.txt"]);
  });

  it("excludes directories when there are multiple folders", async () => {
    const zipFile = await openZip(zipWithFolderPath, {
      lazyEntries: true,
    });
    const entries = await readZipEntries(zipFile);
    const entriesWithoutDirectories = excludeDirectories(entries);

    expect(
      entriesWithoutDirectories.map((entry) => entry.fileName).sort(),
    ).toEqual([
      "__MACOSX/._folder1",
      "__MACOSX/folder1/._textFile.txt",
      "__MACOSX/folder1/._textFile2.txt",
      "folder1/folder2/textFile3.txt",
      "folder1/textFile.txt",
      "folder1/textFile2.txt",
    ]);
  });
});

describe("openZipBuffer", () => {
  it("can read an entry in the zip file", async () => {
    const zipFile = await openZip(zipWithFolderPath, {
      lazyEntries: true,
      autoClose: false,
    });
    const entries = await readZipEntries(zipFile);

    const entry = entries.find(
      (entry) => entry.fileName === "folder1/textFile.txt",
    );
    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }

    const buffer = await openZipBuffer(zipFile, entry);
    expect(buffer).toHaveLength(12);
    expect(buffer.toString("utf8")).toEqual("I am a text\n");
  });
});
