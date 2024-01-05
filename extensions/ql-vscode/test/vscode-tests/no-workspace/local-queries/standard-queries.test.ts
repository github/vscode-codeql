import { mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import { join } from "path";
import { createLockFileForStandardQuery } from "../../../../src/local-queries/standard-queries";
import { outputFile, pathExists } from "fs-extra";

describe("createLockFileForStandardQuery", () => {
  let tmpDir: DirectoryResult;
  let packPath: string;
  let qlpackPath: string;
  let queryPath: string;

  const packPacklist = jest.fn();
  const packResolveDependencies = jest.fn();
  const clearCache = jest.fn();
  const packInstall = jest.fn();

  const mockCli = mockedObject<CodeQLCliServer>({
    packPacklist,
    packResolveDependencies,
    clearCache,
    packInstall,
  });

  beforeEach(async () => {
    tmpDir = await dir({
      unsafeCleanup: true,
    });

    packPath = join(tmpDir.path, "a", "b");
    qlpackPath = join(packPath, "qlpack.yml");
    queryPath = join(packPath, "d", "e", "query.ql");

    packPacklist.mockResolvedValue([qlpackPath, queryPath]);
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  describe("when the lock file exists", () => {
    let lockfilePath: string;

    beforeEach(async () => {
      lockfilePath = join(packPath, "qlpack.lock.yml");

      packPacklist.mockResolvedValue([qlpackPath, lockfilePath, queryPath]);
    });

    it("does not resolve or install dependencies", async () => {
      expect(await createLockFileForStandardQuery(mockCli, queryPath)).toEqual({
        cleanup: undefined,
      });

      expect(packResolveDependencies).not.toHaveBeenCalled();
      expect(clearCache).not.toHaveBeenCalled();
      expect(packInstall).not.toHaveBeenCalled();
    });

    it("does not resolve or install dependencies with a codeql-pack.lock.yml", async () => {
      lockfilePath = join(packPath, "codeql-pack.lock.yml");

      packPacklist.mockResolvedValue([qlpackPath, lockfilePath, queryPath]);

      expect(await createLockFileForStandardQuery(mockCli, queryPath)).toEqual({
        cleanup: undefined,
      });

      expect(packResolveDependencies).not.toHaveBeenCalled();
      expect(clearCache).not.toHaveBeenCalled();
      expect(packInstall).not.toHaveBeenCalled();
    });
  });

  describe("when the lock file does not exist", () => {
    it("resolves and installs dependencies", async () => {
      expect(await createLockFileForStandardQuery(mockCli, queryPath)).toEqual({
        cleanup: expect.any(Function),
      });

      expect(packResolveDependencies).toHaveBeenCalledWith(packPath);
      expect(clearCache).toHaveBeenCalledWith();
      expect(packInstall).toHaveBeenCalledWith(packPath);
    });

    it("cleans up the lock file using the cleanup function", async () => {
      const { cleanup } = await createLockFileForStandardQuery(
        mockCli,
        queryPath,
      );
      expect(cleanup).not.toBeUndefined();

      const lockfilePath = join(packPath, "codeql-pack.lock.yml");

      await outputFile(lockfilePath, "lock file contents");

      await cleanup?.();

      expect(await pathExists(lockfilePath)).toBe(false);
    });

    it("does not fail when cleaning up a non-existing lock file", async () => {
      const { cleanup } = await createLockFileForStandardQuery(
        mockCli,
        queryPath,
      );
      expect(cleanup).not.toBeUndefined();

      await cleanup?.();
    });
  });
});
