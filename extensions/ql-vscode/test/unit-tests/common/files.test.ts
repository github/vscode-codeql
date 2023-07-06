import { join } from "path";

import {
  containsPath,
  gatherQlFiles,
  getDirectoryNamesInsidePath,
  pathsEqual,
  readDirFullPaths,
  walkDirectory,
} from "../../../src/common/files";
import { DirResult } from "tmp";
import * as tmp from "tmp";
import { ensureDirSync, symlinkSync, writeFileSync } from "fs-extra";

describe("files", () => {
  const dataDir = join(__dirname, "../../data");
  const data2Dir = join(__dirname, "../../data2");

  describe("gatherQlFiles", () => {
    it("should find one file", async () => {
      const singleFile = join(dataDir, "query.ql");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[singleFile], false]);
    });

    it("should find no files", async () => {
      const result = await gatherQlFiles([]);
      expect(result).toEqual([[], false]);
    });

    it("should find no files", async () => {
      const singleFile = join(dataDir, "library.qll");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[], false]);
    });

    it("should handle invalid file", async () => {
      const singleFile = join(dataDir, "xxx");
      const result = await gatherQlFiles([singleFile]);
      expect(result).toEqual([[], false]);
    });

    it("should find two files", async () => {
      const singleFile = join(dataDir, "query.ql");
      const otherFile = join(dataDir, "multiple-result-sets.ql");
      const notFile = join(dataDir, "library.qll");
      const invalidFile = join(dataDir, "xxx");

      const result = await gatherQlFiles([
        singleFile,
        otherFile,
        notFile,
        invalidFile,
      ]);
      expect(result.sort()).toEqual([[singleFile, otherFile], false]);
    });

    it("should scan a directory", async () => {
      const file1 = join(dataDir, "compute-default-strings.ql");
      const file2 = join(dataDir, "multiple-result-sets.ql");
      const file3 = join(dataDir, "query.ql");

      const result = await gatherQlFiles([dataDir]);
      expect(result.sort()).toEqual([[file1, file2, file3], true]);
    });

    it("should scan a directory and some files", async () => {
      const singleFile = join(dataDir, "query.ql");
      const empty1File = join(data2Dir, "empty1.ql");
      const empty2File = join(data2Dir, "sub-folder", "empty2.ql");

      const result = await gatherQlFiles([singleFile, data2Dir]);
      expect(result.sort()).toEqual([
        [singleFile, empty1File, empty2File],
        true,
      ]);
    });

    it("should avoid duplicates", async () => {
      const file1 = join(dataDir, "compute-default-strings.ql");
      const file2 = join(dataDir, "multiple-result-sets.ql");
      const file3 = join(dataDir, "query.ql");

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
      const filePath = join(data2Dir, "empty1.ql");
      await expect(getDirectoryNamesInsidePath(filePath)).rejects.toThrow(
        `Path is not a directory: ${filePath}`,
      );
    });

    it("should find sub-folders", async () => {
      const result = await getDirectoryNamesInsidePath(data2Dir);
      expect(result).toEqual(["sub-folder"]);
    });
  });

  describe("readDirFullPaths", () => {
    it("should return all files with full path", async () => {
      const file1 = join(dataDir, "compute-default-strings.ql");
      const file2 = join(dataDir, "multiple-result-sets.ql");
      const file3 = join(dataDir, "query.ql");

      const paths = await readDirFullPaths(dataDir);

      expect(paths.some((path) => path === file1)).toBe(true);
      expect(paths.some((path) => path === file2)).toBe(true);
      expect(paths.some((path) => path === file3)).toBe(true);
    });
  });
});

describe("pathsEqual", () => {
  const testCases: Array<{
    path1: string;
    path2: string;
    platform: NodeJS.Platform;
    expected: boolean;
  }> = [
    {
      path1:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "linux",
      expected: true,
    },
    {
      path1:
        "/HOME/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "linux",
      expected: false,
    },
    {
      path1:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "\\home\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      platform: "linux",
      expected: false,
    },
    {
      path1:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: true,
    },
    {
      path1:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "c:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: true,
    },
    {
      path1:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "D:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: false,
    },
    {
      path1:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "C:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      platform: "win32",
      expected: true,
    },
    {
      path1:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      path2:
        "D:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      platform: "win32",
      expected: false,
    },
  ];

  test.each(testCases)(
    "$path1 and $path2 are equal on $platform = $expected",
    ({ path1, path2, platform, expected }) => {
      if (platform !== process.platform) {
        // We're using the platform-specific path.resolve, so we can't really run
        // these tests on all platforms.
        return;
      }

      expect(pathsEqual(path1, path2)).toEqual(expected);
    },
  );
});

describe("containsPath", () => {
  const testCases: Array<{
    parent: string;
    child: string;
    platform: NodeJS.Platform;
    expected: boolean;
  }> = [
    {
      parent:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "linux",
      expected: true,
    },
    {
      parent:
        "/HOME/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "linux",
      expected: false,
    },
    {
      parent:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      child:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      platform: "linux",
      expected: false,
    },
    {
      parent:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-java",
      child:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      platform: "linux",
      expected: false,
    },
    {
      parent:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-java",
      child:
        "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "linux",
      expected: false,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: true,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "c:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: true,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "C:/USERS/GITHUB/PROJECTS/VSCODE-CODEQL-STARTER/CODEQL-CUSTOM-QUERIES-JAVASCRIPT/EXAMPLE.QL",
      platform: "win32",
      expected: true,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "D:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: false,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      child:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      platform: "win32",
      expected: false,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "C:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      platform: "win32",
      expected: true,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      child:
        "D:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      platform: "win32",
      expected: false,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-java",
      child:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript",
      platform: "win32",
      expected: false,
    },
    {
      parent:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-java",
      child:
        "C:/Users/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      platform: "win32",
      expected: false,
    },
  ];

  test.each(testCases)(
    "$parent contains $child on $platform = $expected",
    ({ parent, child, platform, expected }) => {
      if (platform !== process.platform) {
        // We're using the platform-specific path.resolve, so we can't really run
        // these tests on all platforms.
        return;
      }

      expect(containsPath(parent, child)).toEqual(expected);
    },
  );
});

describe("walkDirectory", () => {
  let tmpDir: DirResult;
  let dir: string;
  let dir2: string;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    dir = join(tmpDir.name, "dir");
    ensureDirSync(dir);
    dir2 = join(tmpDir.name, "dir2");
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it("should walk a directory", async () => {
    const file1 = join(dir, "file1");
    const file2 = join(dir, "file2");
    const file3 = join(dir, "file3");
    const dir3 = join(dir, "dir3");
    const file4 = join(dir, "file4");
    const file5 = join(dir, "file5");
    const file6 = join(dir, "file6");

    // These symlinks link back to paths that are already existing, so ignore.
    const symLinkFile7 = join(dir, "symlink0");
    const symlinkDir = join(dir2, "symlink1");

    // some symlinks that point outside of the base dir.
    const file8 = join(tmpDir.name, "file8");
    const file9 = join(dir2, "file8");
    const symlinkDir2 = join(dir2, "symlink2");
    const symlinkFile2 = join(dir2, "symlinkFile3");

    ensureDirSync(dir2);
    ensureDirSync(dir3);

    writeFileSync(file1, "file1");
    writeFileSync(file2, "file2");
    writeFileSync(file3, "file3");
    writeFileSync(file4, "file4");
    writeFileSync(file5, "file5");
    writeFileSync(file6, "file6");
    writeFileSync(file8, "file8");
    writeFileSync(file9, "file9");

    // We don't really need to be testing all of these variants of symlinks,
    // but it doesn't hurt, and will help us if we ever do decide to support them.
    symlinkSync(file6, symLinkFile7, "file");
    symlinkSync(dir3, symlinkDir, "dir");
    symlinkSync(file8, symlinkFile2, "file");
    symlinkSync(dir2, symlinkDir2, "dir");

    const files = [];
    for await (const file of walkDirectory(dir)) {
      files.push(file);
    }

    // Only real files should be returned.
    expect(files.sort()).toEqual([file1, file2, file3, file4, file5, file6]);
  });
});
