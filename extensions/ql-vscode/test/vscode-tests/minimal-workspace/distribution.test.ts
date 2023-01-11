import * as fetch from "node-fetch";
import { Range } from "semver";

import * as helpers from "../../../src/helpers";
import { extLogger } from "../../../src/common";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import * as tmp from "tmp-promise";
import {
  GithubRelease,
  GithubReleaseAsset,
  ReleasesApiConsumer,
  getExecutableFromDirectory,
  DistributionManager,
} from "../../../src/distribution";
import { DirectoryResult } from "tmp-promise";

jest.mock("os", () => {
  const original = jest.requireActual("os");
  return {
    ...original,
    platform: jest.fn(),
  };
});

const mockedOS = jest.mocked(os);

describe("Releases API consumer", () => {
  const owner = "someowner";
  const repo = "somerepo";
  const unconstrainedVersionRange = new Range("*");

  describe("picking the latest release", () => {
    const sampleReleaseResponse: GithubRelease[] = [
      {
        assets: [],
        created_at: "2019-09-01T00:00:00Z",
        id: 1,
        name: "",
        prerelease: false,
        tag_name: "v2.1.0",
      },
      {
        assets: [],
        created_at: "2019-08-10T00:00:00Z",
        id: 2,
        name: "",
        prerelease: false,
        tag_name: "v3.1.1",
      },
      {
        assets: [
          {
            id: 1,
            name: "exampleAsset.txt",
            size: 1,
          },
        ],
        created_at: "2019-09-05T00:00:00Z",
        id: 3,
        name: "",
        prerelease: false,
        tag_name: "v2.0.0",
      },
      {
        assets: [],
        created_at: "2019-08-11T00:00:00Z",
        id: 4,
        name: "",
        prerelease: true,
        tag_name: "v3.1.2-pre-1.1",
      },
      // Release ID 5 is older than release ID 4 but its version has a higher precedence, so release
      // ID 5 should be picked over release ID 4.
      {
        assets: [],
        created_at: "2019-08-09T00:00:00Z",
        id: 5,
        name: "",
        prerelease: true,
        tag_name: "v3.1.2-pre-2.0",
      },
    ];

    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          return Promise.resolve(
            new fetch.Response(JSON.stringify(sampleReleaseResponse)),
          );
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    it("picked release has version with the highest precedence", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      const latestRelease = await consumer.getLatestRelease(
        unconstrainedVersionRange,
      );
      expect(latestRelease.id).toBe(2);
    });

    it("version of picked release is within the version range", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      const latestRelease = await consumer.getLatestRelease(new Range("2.*.*"));
      expect(latestRelease.id).toBe(1);
    });

    it("fails if none of the releases are within the version range", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      await expect(
        consumer.getLatestRelease(new Range("5.*.*")),
      ).rejects.toThrowError();
    });

    it("picked release passes additional compatibility test if an additional compatibility test is specified", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      const latestRelease = await consumer.getLatestRelease(
        new Range("2.*.*"),
        true,
        (release) =>
          release.assets.some((asset) => asset.name === "exampleAsset.txt"),
      );
      expect(latestRelease.id).toBe(3);
    });

    it("fails if none of the releases pass the additional compatibility test", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      await expect(
        consumer.getLatestRelease(new Range("2.*.*"), true, (release) =>
          release.assets.some(
            (asset) => asset.name === "otherExampleAsset.txt",
          ),
        ),
      ).rejects.toThrowError();
    });

    it("picked release is the most recent prerelease when includePrereleases is set", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      const latestRelease = await consumer.getLatestRelease(
        unconstrainedVersionRange,
        true,
      );
      expect(latestRelease.id).toBe(5);
    });
  });

  it("gets correct assets for a release", async () => {
    const expectedAssets: GithubReleaseAsset[] = [
      {
        id: 1,
        name: "firstAsset",
        size: 11,
      },
      {
        id: 2,
        name: "secondAsset",
        size: 12,
      },
    ];

    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          const responseBody: GithubRelease[] = [
            {
              assets: expectedAssets,
              created_at: "2019-09-01T00:00:00Z",
              id: 1,
              name: "Release 1",
              prerelease: false,
              tag_name: "v2.0.0",
            },
          ];

          return Promise.resolve(
            new fetch.Response(JSON.stringify(responseBody)),
          );
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const assets = (await consumer.getLatestRelease(unconstrainedVersionRange))
      .assets;

    expect(assets.length).toBe(expectedAssets.length);
    expectedAssets.map((expectedAsset, index) => {
      expect(assets[index].id).toBe(expectedAsset.id);
      expect(assets[index].name).toBe(expectedAsset.name);
      expect(assets[index].size).toBe(expectedAsset.size);
    });
  });
});

describe("Launcher path", () => {
  let warnSpy: jest.SpiedFunction<typeof helpers.showAndLogWarningMessage>;
  let errorSpy: jest.SpiedFunction<typeof helpers.showAndLogErrorMessage>;
  let logSpy: jest.SpiedFunction<typeof extLogger.log>;

  let directory: DirectoryResult;

  let pathToCmd: string;
  let pathToExe: string;

  beforeEach(async () => {
    warnSpy = jest
      .spyOn(helpers, "showAndLogWarningMessage")
      .mockResolvedValue(undefined);
    errorSpy = jest
      .spyOn(helpers, "showAndLogErrorMessage")
      .mockResolvedValue(undefined);
    logSpy = jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    mockedOS.platform.mockReturnValue("win32");

    directory = await tmp.dir({
      unsafeCleanup: true,
    });

    pathToCmd = path.join(directory.path, "codeql.cmd");
    pathToExe = path.join(directory.path, "codeql.exe");
  });

  afterEach(async () => {
    await directory.cleanup();
  });

  it("should not warn with proper launcher name", async () => {
    await fs.writeFile(pathToExe, "");

    const result = await getExecutableFromDirectory(directory.path);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToExe);
  });

  it("should warn when using a hard-coded deprecated launcher name", async () => {
    await fs.writeFile(pathToCmd, "");

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
    await fs.writeFile(pathToCmd, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      undefined as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // no warning or error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(0);
  });

  it("should warn when deprecated launcher is used, and new launcher is available", async () => {
    await fs.writeFile(pathToCmd, "");
    await fs.writeFile(pathToExe, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      undefined as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // has warning message
    expect(warnSpy).toBeCalledTimes(1);
    expect(errorSpy).toBeCalledTimes(0);
  });

  it("should warn when launcher path is incorrect", async () => {
    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      undefined as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBeUndefined();

    // no error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(1);
  });
});
