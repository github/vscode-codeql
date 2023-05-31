import { DirResult, dirSync } from "tmp";
import {
  asyncFilter,
  getErrorMessage,
  walkDirectory,
} from "../../../src/pure/helpers-pure";
import { join } from "path";
import { ensureDirSync, symlinkSync, writeFileSync } from "fs-extra";

describe("helpers-pure", () => {
  it("should filter asynchronously", async () => {
    expect(await asyncFilter([1, 2, 3], (x) => Promise.resolve(x > 2))).toEqual(
      [3],
    );
  });

  it("should throw on error when filtering", async () => {
    const rejects = (x: number) =>
      x === 3 ? Promise.reject(new Error("opps")) : Promise.resolve(true);

    try {
      await asyncFilter([1, 2, 3], rejects);
      fail("Should have thrown");
    } catch (e) {
      expect(getErrorMessage(e)).toBe("opps");
    }
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
});
