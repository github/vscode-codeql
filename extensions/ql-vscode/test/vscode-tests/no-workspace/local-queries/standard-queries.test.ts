import { mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import { join } from "path";
import { createLockFileForStandardQuery } from "../../../../src/local-queries/standard-queries";
import { outputFile, pathExists, readFile } from "fs-extra";

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
    it.each(["qlpack.lock.yml", "codeql-pack.lock.yml"])(
      "does not resolve or install dependencies with %s",
      async (lockFileName) => {
        const lockFilePath = join(packPath, lockFileName);
        const lockFileContents = `${lockFileName} contents`;
        await outputFile(lockFilePath, lockFileContents);

        const { cleanup } = await createLockFileForStandardQuery(
          mockCli,
          queryPath,
        );

        expect({
          cleanup,
          packResolveDependenciesCallCount:
            packResolveDependencies.mock.calls.length,
          clearCacheCallCount: clearCache.mock.calls.length,
          packInstallCallCount: packInstall.mock.calls.length,
          lockFileContents: await readFile(lockFilePath, "utf8"),
        }).toEqual({
          cleanup: undefined,
          packResolveDependenciesCallCount: 0,
          clearCacheCallCount: 0,
          packInstallCallCount: 0,
          lockFileContents,
        });
      },
    );
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
