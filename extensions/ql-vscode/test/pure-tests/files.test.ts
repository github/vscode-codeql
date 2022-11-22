import * as path from "path";

import {
  gatherQlFiles,
  getDirectoryNamesInsidePath,
} from "../../src/pure/files";

describe("files", () => {
  const dataDir = path.join(path.dirname(__dirname), "data");
  const data2Dir = path.join(path.dirname(__dirname), "data2");

  describe("gatherQlFiles", () => {
    it("should find one file", async () => {
      const singleFile = path.join(dataDir, "query.ql");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[singleFile], false]);
    });

    it("should find no files", async () => {
      const result = await gatherQlFiles([]);
      expect(result).toEqual([[], false]);
    });

    it("should find no files", async () => {
      const singleFile = path.join(dataDir, "library.qll");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[], false]);
    });

    it("should handle invalid file", async () => {
      const singleFile = path.join(dataDir, "xxx");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[], false]);
    });

    it("should find two files", async () => {
      const singleFile = path.join(dataDir, "query.ql");
      const otherFile = path.join(dataDir, "multiple-result-sets.ql");
      const notFile = path.join(dataDir, "library.qll");
      const invalidFile = path.join(dataDir, "xxx");

      const result = await gatherQlFiles([
        singleFile,
        otherFile,
        notFile,
        invalidFile,
      ]);
      expect(result.sort()).toEqual([[singleFile, otherFile], false]);
    });

    it("should scan a directory", async () => {
      const file1 = path.join(dataDir, "compute-default-strings.ql");
      const file2 = path.join(dataDir, "multiple-result-sets.ql");
      const file3 = path.join(dataDir, "query.ql");

      const result = await gatherQlFiles([dataDir]);
      expect(result.sort()).toEqual([[file1, file2, file3], true]);
    });

    it("should scan a directory and some files", async () => {
      const singleFile = path.join(dataDir, "query.ql");
      const empty1File = path.join(data2Dir, "empty1.ql");
      const empty2File = path.join(data2Dir, "sub-folder", "empty2.ql");

      const result = await gatherQlFiles([singleFile, data2Dir]);
      expect(result.sort()).toEqual([
        [singleFile, empty1File, empty2File],
        true,
      ]);
    });

    it("should avoid duplicates", async () => {
      const file1 = path.join(dataDir, "compute-default-strings.ql");
      const file2 = path.join(dataDir, "multiple-result-sets.ql");
      const file3 = path.join(dataDir, "query.ql");

      const result = await gatherQlFiles([file1, dataDir, file3]);
      result[0].sort();
      expect(result.sort()).toEqual([[file1, file2, file3], true]);
    });
  });

  describe("getDirectoryNamesInsidePath", () => {
    it("should fail if path does not exist", async () => {
      await expect(getDirectoryNamesInsidePath("xxx")).rejects.toThrow(
        "Path does not exist: xxx",
      );
    });

    it("should fail if path is not a directory", async () => {
      const filePath = path.join(data2Dir, "empty1.ql");
      await expect(getDirectoryNamesInsidePath(filePath)).rejects.toThrow(
        `Path is not a directory: ${filePath}`,
      );
    });

    it("should find sub-folders", async () => {
      const result = await getDirectoryNamesInsidePath(data2Dir);
      expect(result).toEqual(["sub-folder"]);
    });
  });
});
