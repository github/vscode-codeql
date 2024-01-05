import { resolve } from "path";

import type { ZipFileReference } from "../../../../../src/common/vscode/archive-filesystem-provider";
import {
  encodeSourceArchiveUri,
  encodeArchiveBasePath,
  ArchiveFileSystemProvider,
  decodeSourceArchiveUri,
  zipArchiveScheme,
} from "../../../../../src/common/vscode/archive-filesystem-provider";
import { FileType, FileSystemError, Uri } from "vscode";

describe("archive-filesystem-provider", () => {
  it("reads empty file correctly", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/single_file.zip",
      ),
      pathWithinSourceArchive: "/aFileName.txt",
    });
    const data = await archiveProvider.readFile(uri);
    expect(data.length).toBe(0);
  });

  it("read non-empty file correctly", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/textFile.txt",
    });
    const data = await archiveProvider.readFile(uri);
    expect(Buffer.from(data).toString("utf8")).toBe("I am a text\n");
  });

  it("read a directory", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1",
    });
    const files = await archiveProvider.readDirectory(uri);
    expect(files).toHaveLength(3);
    expect(files).toContainEqual(["folder2", FileType.Directory]);
    expect(files).toContainEqual(["textFile.txt", FileType.File]);
    expect(files).toContainEqual(["textFile2.txt", FileType.File]);
  });

  it("should handle a missing directory", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/not-here",
    });
    try {
      await archiveProvider.readDirectory(uri);
      throw new Error("Failed");
    } catch (e) {
      expect(e).toBeInstanceOf(FileSystemError);
    }
  });

  it("should handle a missing file", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/not-here",
    });
    try {
      await archiveProvider.readFile(uri);
      throw new Error("Failed");
    } catch (e) {
      expect(e).toBeInstanceOf(FileSystemError);
    }
  });

  it("should handle reading a file as a directory", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/textFile.txt",
    });
    try {
      await archiveProvider.readDirectory(uri);
      throw new Error("Failed");
    } catch (e) {
      expect(e).toBeInstanceOf(FileSystemError);
    }
  });

  it("should handle reading a directory as a file", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/folder2",
    });
    try {
      await archiveProvider.readFile(uri);
      throw new Error("Failed");
    } catch (e) {
      expect(e).toBeInstanceOf(FileSystemError);
    }
  });

  it("read a nested directory", async () => {
    const archiveProvider = new ArchiveFileSystemProvider();
    const uri = encodeSourceArchiveUri({
      sourceArchiveZipPath: resolve(
        __dirname,
        "../../data/archive-filesystem-provider-test/zip_with_folder.zip",
      ),
      pathWithinSourceArchive: "folder1/folder2",
    });
    const files = await archiveProvider.readDirectory(uri);
    expect(files).toEqual([["textFile3.txt", FileType.File]]);
  });
});

describe("source archive uri encoding", () => {
  const testCases: Array<{ name: string; input: ZipFileReference }> = [
    {
      name: "mixed case and unicode",
      input: {
        sourceArchiveZipPath: "/I-\u2665-codeql.zip",
        pathWithinSourceArchive: "/foo/bar",
      },
    },
    {
      name: "Windows path",
      input: {
        sourceArchiveZipPath: "C:/Users/My Name/folder/src.zip",
        pathWithinSourceArchive: "/foo/bar.ext",
      },
    },
    {
      name: "Unix path",
      input: {
        sourceArchiveZipPath: "/home/folder/src.zip",
        pathWithinSourceArchive: "/foo/bar.ext",
      },
    },
    {
      name: "Empty path",
      input: {
        sourceArchiveZipPath: "/home/folder/src.zip",
        pathWithinSourceArchive: "/",
      },
    },
  ];
  for (const testCase of testCases) {
    it(`should work round trip with ${testCase.name}`, () => {
      const output = decodeSourceArchiveUri(
        encodeSourceArchiveUri(testCase.input),
      );
      expect(output).toEqual(testCase.input);
    });
  }

  it('should decode an empty path as a "/"', () => {
    const uri = encodeSourceArchiveUri({
      pathWithinSourceArchive: "",
      sourceArchiveZipPath: "a/b/c",
    });
    expect(decodeSourceArchiveUri(uri)).toEqual({
      pathWithinSourceArchive: "/",
      sourceArchiveZipPath: "a/b/c",
    });
  });

  it("should encode a uri at the root of the archive", () => {
    const path = "/a/b/c/src.zip";
    const uri = encodeArchiveBasePath(path);
    expect(uri.path).toBe(path);
    expect(decodeSourceArchiveUri(uri).pathWithinSourceArchive).toBe("/");
    expect(decodeSourceArchiveUri(uri).sourceArchiveZipPath).toBe(path);
    expect(uri.authority).toBe("0-14");
  });

  it("should handle malformed uri with no authority", () => {
    // This handles codeql-zip-archive uris generated using the `with` method
    const uri = Uri.parse("file:/a/b/c/src.zip").with({
      scheme: zipArchiveScheme,
    });
    expect(uri.authority).toBe("");
    expect(decodeSourceArchiveUri(uri)).toEqual({
      sourceArchiveZipPath: "/a/b/c/src.zip",
      pathWithinSourceArchive: "/",
    });
  });
});
