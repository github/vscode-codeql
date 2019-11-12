import { expect } from "chai";
import * as fetch from "node-fetch";
import "mocha";
import { Version } from "../../cli-version";
import { GithubRelease, GithubReleaseAsset, ReleasesApiConsumer, versionCompare } from "../../distribution"

describe("Releases API consumer", () => {
  const owner = "someowner";
  const repo = "somerepo";
  const sampleReleaseResponse: GithubRelease[] = [
    {
      "assets": [],
      "created_at": "2019-09-01T00:00:00Z",
      "id": 1,
      "name": "",
      "prerelease": false,
      "tag_name": "v2.1.0"
    },
    {
      "assets": [],
      "created_at": "2019-08-10T00:00:00Z",
      "id": 2,
      "name": "",
      "prerelease": false,
      "tag_name": "v3.1.1"
    },
    {
      "assets": [],
      "created_at": "2019-09-05T00:00:00Z",
      "id": 3,
      "name": "",
      "prerelease": false,
      "tag_name": "v2.0.0"
    },
    {
      "assets": [],
      "created_at": "2019-08-11T00:00:00Z",
      "id": 4,
      "name": "",
      "prerelease": true,
      "tag_name": "v3.1.2-pre"
    },
  ];
  const unconstrainedVersionConstraint = {
    description: "*",
    isVersionCompatible: () => true
  };

  it("picking latest release: is based on version", async () => {
    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          return Promise.resolve(new fetch.Response(JSON.stringify(sampleReleaseResponse)));
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const latestRelease = await consumer.getLatestRelease(unconstrainedVersionConstraint);
    expect(latestRelease.id).to.equal(2);
  });

  it("picking latest release: obeys version constraints", async () => {
    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          return Promise.resolve(new fetch.Response(JSON.stringify(sampleReleaseResponse)));
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const latestRelease = await consumer.getLatestRelease({
      description: "2.*.*",
      isVersionCompatible: version => version.majorVersion === 2
    });
    expect(latestRelease.id).to.equal(1);
  });

  it("picking latest release: includes prereleases when option set", async () => {
    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          return Promise.resolve(new fetch.Response(JSON.stringify(sampleReleaseResponse)));
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const latestRelease = await consumer.getLatestRelease(unconstrainedVersionConstraint, true);
    expect(latestRelease.id).to.equal(4);
  });

  it("gets correct assets for a release", async () => {
    const expectedAssets: GithubReleaseAsset[] = [
      {
        "id": 1,
        "name": "firstAsset",
        "size": 11
      },
      {
        "id": 2,
        "name": "secondAsset",
        "size": 12
      }
    ];

    class MockReleasesApiConsumer extends ReleasesApiConsumer {
      protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
        if (apiPath === `/repos/${owner}/${repo}/releases`) {
          const responseBody: GithubRelease[] = [{
            "assets": expectedAssets,
            "created_at": "2019-09-01T00:00:00Z",
            "id": 1,
            "name": "Release 1",
            "prerelease": false,
            "tag_name": "v2.0.0"
          }];

          return Promise.resolve(new fetch.Response(JSON.stringify(responseBody)));
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const assets = (await consumer.getLatestRelease(unconstrainedVersionConstraint)).assets;

    expect(assets.length).to.equal(expectedAssets.length);
    expectedAssets.map((expectedAsset, index) => {
      expect(assets[index].id).to.equal(expectedAsset.id);
      expect(assets[index].name).to.equal(expectedAsset.name);
      expect(assets[index].size).to.equal(expectedAsset.size);
    });
  });
});

describe("Release version ordering", () => {
  function createVersion(majorVersion: number, minorVersion: number, patchVersion: number, prereleaseVersion?: string, buildMetadata?: string): Version {
    return {
      buildMetadata,
      majorVersion,
      minorVersion,
      patchVersion,
      prereleaseVersion,
      rawString: `${majorVersion}.${minorVersion}.${patchVersion}` +
      prereleaseVersion ? `-${prereleaseVersion}` : "" +
      buildMetadata ? `+${buildMetadata}` : ""
    };
  }

  it("major versions compare correctly", () => {
    expect(versionCompare(createVersion(3, 0, 0), createVersion(2, 9, 9)) > 0).to.be.true;
  });

  it("minor versions compare correctly", () => {
    expect(versionCompare(createVersion(2, 1, 0), createVersion(2, 0, 9)) > 0).to.be.true;
  });

  it("patch versions compare correctly", () => {
    expect(versionCompare(createVersion(2, 1, 2), createVersion(2, 1, 1)) > 0).to.be.true;
  });

  it("prerelease versions compare correctly", () => {
    expect(versionCompare(createVersion(2, 1, 0, "alpha.2"), createVersion(2, 1, 0, "alpha.1")) > 0).to.true;
  });

  it("build metadata compares correctly", () => {
    expect(versionCompare(createVersion(2, 1, 0, "alpha.1", "abcdef0"), createVersion(2, 1, 0, "alpha.1", "bcdef01"))).to.equal(0);
  });
});
