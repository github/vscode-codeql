import { Range } from "semver";

import type { GithubRelease } from "../../../../src/codeql-cli/distribution/releases-api-consumer";
import { ReleasesApiConsumer } from "../../../../src/codeql-cli/distribution/releases-api-consumer";

describe("Releases API consumer", () => {
  const repositoryNwo = "someowner/somerepo";
  const unconstrainedVersionRange = new Range("*");

  const sampleReleaseResponse: GithubRelease[] = [
    {
      assets: [],
      created_at: "2019-09-01T00:00:00Z",
      id: 1,
      name: "v2.1.0",
      prerelease: false,
      tag_name: "v2.1.0",
    },
    {
      assets: [
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
      ],
      created_at: "2019-08-10T00:00:00Z",
      id: 2,
      name: "v3.1.1",
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
      name: "v2.0.0",
      prerelease: false,
      tag_name: "v2.0.0",
    },
    {
      assets: [],
      created_at: "2019-08-11T00:00:00Z",
      id: 4,
      name: "v3.1.2-pre-1.1",
      prerelease: true,
      tag_name: "v3.1.2-pre-1.1",
    },
    // Release ID 5 is older than release ID 4 but its version has a higher precedence, so release
    // ID 5 should be picked over release ID 4.
    {
      assets: [],
      created_at: "2019-08-09T00:00:00Z",
      id: 5,
      name: "v3.1.2-pre-2.0",
      prerelease: true,
      tag_name: "v3.1.2-pre-2.0",
    },
    // Has a tag_name that is not valid semver
    {
      assets: [],
      created_at: "2019-08-010T00:00:00Z",
      id: 6,
      name: "codeql-bundle-20231220",
      prerelease: true,
      tag_name: "codeql-bundle-20231220",
    },
  ];

  class MockReleasesApiConsumer extends ReleasesApiConsumer {
    protected async makeApiCall(apiPath: string): Promise<Response> {
      if (apiPath === `/repos/${repositoryNwo}/releases`) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleReleaseResponse)),
        );
      }
      return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
    }
  }

  describe("picking the latest release", () => {
    it("picked release is non-prerelease with the highest semver", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(
        unconstrainedVersionRange,
        true,
      );
      expect(latestRelease.id).toBe(2);
    });

    it("picked release is non-prerelease with highest id", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(
        unconstrainedVersionRange,
        false,
      );
      expect(latestRelease.id).toBe(3);
    });

    it("version of picked release is within the version range", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(new Range("2.*.*"));
      expect(latestRelease.id).toBe(1);
    });

    it("fails if none of the releases are within the version range", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      await expect(
        consumer.getLatestRelease(new Range("5.*.*")),
      ).rejects.toThrow();
    });

    it("picked release passes additional compatibility test if an additional compatibility test is specified", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(
        new Range("2.*.*"),
        true,
        true,
        (release) =>
          release.assets.some((asset) => asset.name === "exampleAsset.txt"),
      );
      expect(latestRelease.id).toBe(3);
    });

    it("fails if none of the releases pass the additional compatibility test", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      await expect(
        consumer.getLatestRelease(new Range("2.*.*"), true, true, (release) =>
          release.assets.some(
            (asset) => asset.name === "otherExampleAsset.txt",
          ),
        ),
      ).rejects.toThrow();
    });

    it("picked release is the most recent prerelease when includePrereleases is set", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(
        unconstrainedVersionRange,
        true,
        true,
      );
      expect(latestRelease.id).toBe(5);
    });

    it("ignores invalid semver and picks (pre-)release with highest id", async () => {
      const consumer = new MockReleasesApiConsumer(repositoryNwo);

      const latestRelease = await consumer.getLatestRelease(
        undefined,
        false,
        true,
      );
      expect(latestRelease.id).toBe(6);
    });
  });

  it("gets correct assets for a release", async () => {
    const consumer = new MockReleasesApiConsumer(repositoryNwo);

    const assets = (await consumer.getLatestRelease(unconstrainedVersionRange))
      .assets;

    expect(assets).toEqual([
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
    ]);
  });
});
