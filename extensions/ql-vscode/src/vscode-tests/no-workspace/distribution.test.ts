import * as path from "path";
import * as fetch from "node-fetch";
import * as semver from "semver";

import * as helpers from "../../helpers";
import { logger } from "../../logging";
import * as fs from "fs-extra";
import * as os from "os";
import {
  GithubRelease,
  GithubReleaseAsset,
  ReleasesApiConsumer,
  getExecutableFromDirectory,
  DistributionManager,
} from "../../distribution";

describe("Releases API consumer", () => {
  const owner = "someowner";
  const repo = "somerepo";
  const unconstrainedVersionRange = new semver.Range("*");

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

      const latestRelease = await consumer.getLatestRelease(
        new semver.Range("2.*.*"),
      );
      expect(latestRelease.id).toBe(1);
    });

    it("fails if none of the releases are within the version range", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      await expect(
        consumer.getLatestRelease(new semver.Range("5.*.*")),
      ).rejects.toThrowError();
    });

    it("picked release passes additional compatibility test if an additional compatibility test is specified", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      const latestRelease = await consumer.getLatestRelease(
        new semver.Range("2.*.*"),
        true,
        (release) =>
          release.assets.some((asset) => asset.name === "exampleAsset.txt"),
      );
      expect(latestRelease.id).toBe(3);
    });

    it("fails if none of the releases pass the additional compatibility test", async () => {
      const consumer = new MockReleasesApiConsumer(owner, repo);

      await expect(
        consumer.getLatestRelease(new semver.Range("2.*.*"), true, (release) =>
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
  const pathToCmd = `abc${path.sep}codeql.cmd`;
  const pathToExe = `abc${path.sep}codeql.exe`;

  let warnSpy: jest.SpiedFunction<typeof helpers.showAndLogWarningMessage>;
  let errorSpy: jest.SpiedFunction<typeof helpers.showAndLogErrorMessage>;
  let logSpy: jest.SpiedFunction<typeof logger.log>;
  let pathExistsSpy: jest.SpiedFunction<typeof fs.pathExists>;

  let launcherThatExists = "";

  beforeEach(() => {
    warnSpy = jest
      .spyOn(helpers, "showAndLogWarningMessage")
      .mockResolvedValue(undefined);
    errorSpy = jest
      .spyOn(helpers, "showAndLogErrorMessage")
      .mockResolvedValue(undefined);
    logSpy = jest.spyOn(logger, "log").mockResolvedValue(undefined);
    pathExistsSpy = jest
      .spyOn(fs, "pathExists")
      .mockImplementation(async (path: string) => {
        return path.endsWith(launcherThatExists);
      });

    jest.spyOn(os, "platform").mockReturnValue("win32");
  });

  it("should not warn with proper launcher name", async () => {
    launcherThatExists = "codeql.exe";
    const result = await getExecutableFromDirectory("abc");
    expect(pathExistsSpy).toBeCalledWith(pathToExe);

    // correct launcher has been found, so alternate one not looked for
    expect(pathExistsSpy).not.toBeCalledWith(pathToCmd);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToExe);
  });

  it("should warn when using a hard-coded deprecated launcher name", async () => {
    launcherThatExists = "codeql.cmd";
    const result = await getExecutableFromDirectory("abc");
    expect(pathExistsSpy).toBeCalledWith(pathToExe);
    expect(pathExistsSpy).toBeCalledWith(pathToCmd);

    // Should have opened a warning message
    expect(warnSpy).toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToCmd);
  });

  it("should avoid warn when no launcher is found", async () => {
    launcherThatExists = "xxx";
    const result = await getExecutableFromDirectory("abc", false);
    expect(pathExistsSpy).toBeCalledWith(pathToExe);
    expect(pathExistsSpy).toBeCalledWith(pathToCmd);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should warn when no launcher is found", async () => {
    launcherThatExists = "xxx";
    const result = await getExecutableFromDirectory("abc", true);
    expect(pathExistsSpy).toBeCalledWith(pathToExe);
    expect(pathExistsSpy).toBeCalledWith(pathToCmd);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should not warn when deprecated launcher is used, but no new launcher is available", async function () {
    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      undefined as any,
    );
    launcherThatExists = "codeql.cmd";

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // no warning or error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(0);
  });

  it("should warn when deprecated launcher is used, and new launcher is available", async () => {
    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      undefined as any,
    );
    launcherThatExists = ""; // pretend both launchers exist

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
    launcherThatExists = "xxx"; // pretend neither launcher exists

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBeUndefined();

    // no error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(1);
  });
});
