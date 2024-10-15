import { join, parse } from "path";

import {
  containsPath,
  findCommonParentDir,
  findDirWithFile,
  gatherQlFiles,
  getDirectoryNamesInsidePath,
  pathsEqual,
  readDirFullPaths,
  walkDirectory,
} from "../../../src/common/files";
import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import {
  createFileSync,
  ensureDirSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from "fs-extra";
import "../../matchers/toEqualPath";

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
      const file2 = join(dataDir, "debugger", "QuickEvalBigIntQuery.ql");
      const file3 = join(dataDir, "debugger", "QuickEvalQuery.ql");
      const file4 = join(dataDir, "debugger", "simple-query.ql");
      const file5 = join(dataDir, "multiple-result-sets.ql");
      const file6 = join(dataDir, "query.ql");

      const vaDir = join(dataDir, "variant-analysis-query-packs");
      const file7 = join(vaDir, "workspace1", "dir1", "query1.ql");
      const file8 = join(vaDir, "workspace1", "pack1", "query1.ql");
      const file9 = join(vaDir, "workspace1", "pack1", "query2.ql");
      const file10 = join(vaDir, "workspace1", "pack2", "query1.ql");
      const file11 = join(vaDir, "workspace1", "query1.ql");
      const file12 = join(vaDir, "workspace2", "query1.ql");

      const result = await gatherQlFiles([dataDir]);
      expect(result.sort()).toEqual([
        [
          file1,
          file2,
          file3,
          file4,
          file5,
          file6,
          file7,
          file8,
          file9,
          file10,
          file11,
          file12,
        ],
        true,
      ]);
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
      const file2 = join(dataDir, "debugger", "QuickEvalBigIntQuery.ql");
      const file3 = join(dataDir, "debugger", "QuickEvalQuery.ql");
      const file4 = join(dataDir, "debugger", "simple-query.ql");
      const file5 = join(dataDir, "multiple-result-sets.ql");
      const file6 = join(dataDir, "query.ql");

      const vaDir = join(dataDir, "variant-analysis-query-packs");
      const file7 = join(vaDir, "workspace1", "dir1", "query1.ql");
      const file8 = join(vaDir, "workspace1", "pack1", "query1.ql");
      const file9 = join(vaDir, "workspace1", "pack1", "query2.ql");
      const file10 = join(vaDir, "workspace1", "pack2", "query1.ql");
      const file11 = join(vaDir, "workspace1", "query1.ql");
      const file12 = join(vaDir, "workspace2", "query1.ql");

      const result = await gatherQlFiles([file1, dataDir, file3, file4, file5]);
      result[0].sort();
      expect(result.sort()).toEqual([
        [
          file1,
          file2,
          file3,
          file4,
          file5,
          file6,
          file7,
          file8,
          file9,
          file10,
          file11,
          file12,
        ],
        true,
      ]);
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
    tmpDir = dirSync({ unsafeCleanup: true });
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

describe("findCommonParentDir", () => {
  const rootDir = parse(process.cwd()).root;

  it("should fail if not all paths are not absolute", async () => {
    const paths = [
      join("foo", "bar", "baz"),
      join("/foo", "bar", "qux"),
      join("/foo", "bar", "quux"),
    ];

    expect(() => findCommonParentDir(...paths)).toThrow(
      "All paths must be absolute",
    );
  });

  it("should fail if no path are provided", async () => {
    expect(() => findCommonParentDir()).toThrow(
      "At least one path must be provided",
    );
  });

  it("should find the common parent dir for multiple paths with common parent", () => {
    const paths = [
      join("/foo", "bar", "baz"),
      join("/foo", "bar", "qux"),
      join("/foo", "bar", "quux"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(join("/foo", "bar"));
  });

  it("should return empty path if paths have no common parent", () => {
    const paths = [
      join("/foo", "bar", "baz"),
      join("/qux", "quux", "corge"),
      join("/grault", "garply"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(rootDir);
  });

  it("should handle a mix of dirs and files", async () => {
    const paths = [
      join("/foo", "bar", "baz"),
      join("/foo", "bar", "qux.ql"),
      join("/foo", "bar", "quux"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(join("/foo", "bar"));
  });

  it("should handle dirs that have the same name", async () => {
    const paths = [
      join("/foo", "foo", "bar"),
      join("/foo", "foo", "baz"),
      join("/foo", "foo"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(join("/foo", "foo"));
  });

  it("should handle dirs that have the same subdir structure but different base path", async () => {
    const paths = [
      join("/foo", "bar"),
      join("/bar", "foo", "bar"),
      join("/foo", "foo", "bar"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(rootDir);
  });

  it("should return the same path if all paths are identical", () => {
    const paths = [
      join("/foo", "bar", "baz"),
      join("/foo", "bar", "baz"),
      join("/foo", "bar", "baz"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(join("/foo", "bar", "baz"));
  });

  it("should return the directory path if paths only differ by the file extension", () => {
    const paths = [
      join("/foo", "bar", "baz.txt"),
      join("/foo", "bar", "baz.jpg"),
      join("/foo", "bar", "baz.pdf"),
    ];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(join("/foo", "bar"));
  });

  it("should handle empty paths", () => {
    const paths = ["/", "/", "/"];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(rootDir);
  });

  it("should return the parent dir of a single file", async () => {
    const dataDir = join(__dirname, "../../data");
    const paths = [dataDir];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(dataDir);
  });

  it("should return the dir if a single dir is provided", async () => {
    const dataDir = join(__dirname, "../../data");
    const filePath = join(dataDir, "query.ql");
    const paths = [filePath];

    const commonDir = findCommonParentDir(...paths);

    expect(commonDir).toEqualPath(dataDir);
  });
});

describe("findDirWithFile", () => {
  let dir: DirResult;
  beforeEach(() => {
    dir = dirSync({ unsafeCleanup: true });
    createFile("a");
    createFile("b");
    createFile("c");

    createDir("dir1");
    createFile("dir1", "d");
    createFile("dir1", "e");
    createFile("dir1", "f");

    createDir("dir2");
    createFile("dir2", "g");
    createFile("dir2", "h");
    createFile("dir2", "i");

    createDir("dir2", "dir3");
    createFile("dir2", "dir3", "j");
    createFile("dir2", "dir3", "k");
    createFile("dir2", "dir3", "l");
  });

  it("should find files", async () => {
    expect(await findDirWithFile(dir.name, "k")).toBe(
      join(dir.name, "dir2", "dir3"),
    );
    expect(await findDirWithFile(dir.name, "h")).toBe(join(dir.name, "dir2"));
    expect(await findDirWithFile(dir.name, "z", "a")).toBe(dir.name);
    // there's some slight indeterminism when more than one name exists
    // but in general, this will find files in the current directory before
    // finding files in sub-dirs
    expect(await findDirWithFile(dir.name, "k", "a")).toBe(dir.name);
  });

  it("should not find files", async () => {
    expect(await findDirWithFile(dir.name, "x", "y", "z")).toBeUndefined();
  });

  function createFile(...segments: string[]) {
    createFileSync(join(dir.name, ...segments));
  }

  function createDir(...segments: string[]) {
    mkdirSync(join(dir.name, ...segments));
  }
});
