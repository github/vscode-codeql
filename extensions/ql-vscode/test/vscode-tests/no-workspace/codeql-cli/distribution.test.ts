import * as log from "../../../../src/common/logging/notifications";
import { extLogger } from "../../../../src/common/logging/vscode";
import {
  outputFile,
  outputJson,
  readFile,
  readJson,
  writeFile,
} from "fs-extra";
import { join } from "path";
import * as os from "os";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import type { DistributionState } from "../../../../src/codeql-cli/distribution";
import {
  DEFAULT_DISTRIBUTION_VERSION_RANGE,
  DistributionManager,
  DistributionUpdateCheckResultKind,
  getExecutableFromDirectory,
} from "../../../../src/codeql-cli/distribution";
import type {
  showAndLogErrorMessage,
  showAndLogWarningMessage,
} from "../../../../src/common/logging";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import { mockedObject } from "../../../mocked-object";
import type { DistributionConfig } from "../../../../src/config";
import type { ExtensionContext } from "vscode";
import { Uri } from "vscode";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  codeQlLauncherName,
  getRequiredAssetName,
} from "../../../../src/common/distribution";
import type { GithubRelease } from "../../../../src/codeql-cli/distribution/releases-api-consumer";
import type { Release } from "../../../../src/codeql-cli/distribution/release";
import { zip } from "zip-a-folder";

jest.mock("os", () => {
  const original = jest.requireActual("os");
  return {
    ...original,
    platform: jest.fn(),
  };
});

const mockedOS = jest.mocked(os);

describe("Launcher path", () => {
  let warnSpy: jest.SpiedFunction<typeof showAndLogWarningMessage>;
  let errorSpy: jest.SpiedFunction<typeof showAndLogErrorMessage>;
  let logSpy: jest.SpiedFunction<typeof extLogger.log>;

  let directory: DirectoryResult;

  let pathToCmd: string;
  let pathToExe: string;

  beforeEach(async () => {
    warnSpy = jest
      .spyOn(log, "showAndLogWarningMessage")
      .mockResolvedValue(undefined);
    errorSpy = jest
      .spyOn(log, "showAndLogErrorMessage")
      .mockResolvedValue(undefined);
    logSpy = jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    mockedOS.platform.mockReturnValue("win32");

    directory = await dir({
      unsafeCleanup: true,
    });

    pathToCmd = join(directory.path, "codeql.cmd");
    pathToExe = join(directory.path, "codeql.exe");
  });

  afterEach(async () => {
    await directory.cleanup();
  });

  it("should not warn with proper launcher name", async () => {
    await writeFile(pathToExe, "");

    const result = await getExecutableFromDirectory(directory.path);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToExe);
  });

  it("should warn when using a hard-coded deprecated launcher name", async () => {
    await writeFile(pathToCmd, "");

    const result = await getExecutableFromDirectory(directory.path);

    // Should have opened a warning message
    expect(warnSpy).toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToCmd);
  });

  it("should avoid warn when no launcher is found", async () => {
    const result = await getExecutableFromDirectory(directory.path, false);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should warn when no launcher is found", async () => {
    const result = await getExecutableFromDirectory("abc", true);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should not warn when deprecated launcher is used, but no new launcher is available", async function () {
    await writeFile(pathToCmd, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
      createMockLogger(),
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // no warning or error message
    expect(warnSpy).toHaveBeenCalledTimes(0);
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it("should warn when deprecated launcher is used, and new launcher is available", async () => {
    await writeFile(pathToCmd, "");
    await writeFile(pathToExe, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
      createMockLogger(),
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // has warning message
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it("should warn when launcher path is incorrect", async () => {
    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
      createMockLogger(),
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBeUndefined();

    // no error message
    expect(warnSpy).toHaveBeenCalledTimes(0);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Distribution updates", () => {
  const server = setupServer();
  beforeAll(() =>
    server.listen({
      onUnhandledRequest: "error",
    }),
  );
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  let manager: DistributionManager;

  let globalStorageDirectory: DirectoryResult;

  beforeEach(async () => {
    globalStorageDirectory = await dir({
      unsafeCleanup: true,
    });

    manager = new DistributionManager(
      mockedObject<DistributionConfig>({
        customCodeQlPath: undefined,
        channel: "stable",
        includePrerelease: false,
        personalAccessToken: undefined,
        downloadTimeout: 100,
        onDidChangeConfiguration: () => {},
      }),
      DEFAULT_DISTRIBUTION_VERSION_RANGE,
      mockedObject<ExtensionContext>({
        globalState: {
          get: () => {},
          update: () => {},
        },
        globalStorageUri: Uri.file(globalStorageDirectory.path),
      }),
      createMockLogger(),
    );

    await manager.initialize();
  });

  afterEach(async () => {
    await globalStorageDirectory.cleanup();
  });

  it("should have an empty distribution.json file after initialization", async () => {
    expect(
      await readJson(join(globalStorageDirectory.path, "distribution.json")),
    ).toEqual({
      folderIndex: 0,
      release: null,
    } satisfies DistributionState);
  });

  describe("checkForUpdatesToDistribution", () => {
    beforeEach(() => {
      server.resetHandlers(
        http.get(
          "https://api.github.com/repos/github/codeql-cli-binaries/releases",
          async () => {
            return HttpResponse.json([
              {
                id: 1335,
                name: "v2.2.0",
                tag_name: "v2.2.0",
                created_at: "2024-02-02T02:02:02Z",
                prerelease: false,
                assets: [
                  {
                    id: 783,
                    name: getRequiredAssetName(),
                    size: 2378,
                  },
                ],
              },
              {
                id: 1,
                name: "v2.1.0",
                tag_name: "v2.1.0",
                created_at: "2022-02-02T02:02:02Z",
                prerelease: false,
                assets: [
                  {
                    id: 1,
                    name: getRequiredAssetName(),
                    size: 100,
                  },
                ],
              },
            ] satisfies GithubRelease[]);
          },
        ),
      );
    });

    it("should have an update when no distribution is installed", async () => {
      expect(
        await manager.checkForUpdatesToExtensionManagedDistribution(0),
      ).toEqual({
        kind: DistributionUpdateCheckResultKind.UpdateAvailable,
        updatedRelease: {
          id: 1335,
          name: "v2.2.0",
          createdAt: "2024-02-02T02:02:02Z",
          assets: [
            {
              id: 783,
              name: getRequiredAssetName(),
              size: 2378,
            },
          ],
        },
      } satisfies Awaited<
        ReturnType<typeof manager.checkForUpdatesToExtensionManagedDistribution>
      >);
    });

    it("should not have an update when the latest distribution is installed", async () => {
      await outputJson(join(globalStorageDirectory.path, "distribution.json"), {
        folderIndex: 1,
        release: {
          id: 1335,
          name: "v2.2.0",
          createdAt: "2024-02-02T02:02:02Z",
          assets: [
            {
              id: 783,
              name: getRequiredAssetName(),
              size: 2378,
            },
          ],
        },
      } satisfies DistributionState);
      await outputFile(
        join(
          globalStorageDirectory.path,
          "distribution1",
          "codeql",
          codeQlLauncherName(),
        ),
        "",
      );

      // Re-initialize manager to read the state from the file
      await manager.initialize();

      expect(
        await manager.checkForUpdatesToExtensionManagedDistribution(0),
      ).toEqual({
        kind: DistributionUpdateCheckResultKind.AlreadyUpToDate,
      } satisfies Awaited<
        ReturnType<typeof manager.checkForUpdatesToExtensionManagedDistribution>
      >);
    });

    it("should have an update when an older distribution is installed", async () => {
      await outputJson(join(globalStorageDirectory.path, "distribution.json"), {
        folderIndex: 1,
        release: {
          id: 1,
          name: "v2.1.0",
          createdAt: "2022-02-02T02:02:02Z",
          assets: [
            {
              id: 1,
              name: getRequiredAssetName(),
              size: 100,
            },
          ],
        },
      } satisfies DistributionState);
      await outputFile(
        join(
          globalStorageDirectory.path,
          "distribution1",
          "codeql",
          codeQlLauncherName(),
        ),
        "",
      );

      // Re-initialize manager to read the state from the file
      await manager.initialize();

      expect(
        await manager.checkForUpdatesToExtensionManagedDistribution(0),
      ).toEqual({
        kind: DistributionUpdateCheckResultKind.UpdateAvailable,
        updatedRelease: {
          id: 1335,
          name: "v2.2.0",
          createdAt: "2024-02-02T02:02:02Z",
          assets: [
            {
              id: 783,
              name: getRequiredAssetName(),
              size: 2378,
            },
          ],
        },
      } satisfies Awaited<
        ReturnType<typeof manager.checkForUpdatesToExtensionManagedDistribution>
      >);
    });
  });

  describe("installExtensionManagedDistributionRelease", () => {
    const release: Release = {
      id: 1335,
      name: "v2.2.0",
      createdAt: "2024-02-02T02:02:02Z",
      assets: [
        {
          id: 783,
          name: getRequiredAssetName(),
          size: 2378,
        },
      ],
    };

    let codeqlReleaseZipTempDir: DirectoryResult;
    let codeqlReleaseZipPath: string;

    beforeAll(async () => {
      codeqlReleaseZipTempDir = await dir({
        unsafeCleanup: true,
      });

      await outputFile(
        join(
          codeqlReleaseZipTempDir.path,
          "distribution",
          "codeql",
          codeQlLauncherName(),
        ),
        "launcher!",
      );
      codeqlReleaseZipPath = join(codeqlReleaseZipTempDir.path, "codeql.zip");

      await zip(
        join(codeqlReleaseZipTempDir.path, "distribution"),
        codeqlReleaseZipPath,
      );

      server.resetHandlers(
        http.get(
          "https://api.github.com/repos/github/codeql-cli-binaries/releases/assets/783",
          async () => {
            const file = await readFile(codeqlReleaseZipPath);

            return HttpResponse.arrayBuffer(file, {
              headers: {
                "Content-Type": "application/octet-stream",
              },
            });
          },
        ),
      );
    });

    afterAll(async () => {
      await codeqlReleaseZipTempDir?.cleanup();
    });

    it("installs a distribution when no distribution exists", async () => {
      await manager.installExtensionManagedDistributionRelease(release);

      expect(
        await readJson(join(globalStorageDirectory.path, "distribution.json")),
      ).toEqual({
        folderIndex: 1,
        release,
      } satisfies DistributionState);

      expect(
        await readFile(
          join(
            globalStorageDirectory.path,
            "distribution1",
            "codeql",
            codeQlLauncherName(),
          ),
          "utf-8",
        ),
      ).toEqual("launcher!");
    });

    it("installs a distribution when a distribution already exists", async () => {
      await outputJson(join(globalStorageDirectory.path, "distribution.json"), {
        folderIndex: 78,
        release: {
          id: 1,
          name: "v2.1.0",
          createdAt: "2022-02-02T02:02:02Z",
          assets: [
            {
              id: 1,
              name: getRequiredAssetName(),
              size: 100,
            },
          ],
        },
      } satisfies DistributionState);
      await outputFile(
        join(
          globalStorageDirectory.path,
          "distribution78",
          "codeql",
          codeQlLauncherName(),
        ),
        "",
      );

      // Re-initialize manager to read the state from the file
      await manager.initialize();

      await manager.installExtensionManagedDistributionRelease(release);

      expect(
        await readJson(join(globalStorageDirectory.path, "distribution.json")),
      ).toEqual({
        folderIndex: 79,
        release,
      } satisfies DistributionState);

      expect(
        await readFile(
          join(
            globalStorageDirectory.path,
            "distribution79",
            "codeql",
            codeQlLauncherName(),
          ),
          "utf-8",
        ),
      ).toEqual("launcher!");
    });
  });
});
