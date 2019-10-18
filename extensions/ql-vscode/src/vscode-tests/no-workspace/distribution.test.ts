import { expect } from "chai";
import * as fetch from "node-fetch";
import "mocha";
import { ReleasesApiConsumer } from "../../distribution"

describe("Releases API consumer", () => {
  it("gets correct assets for latest release", async () => {
    const owner = "someowner";
    const repo = "somerepo";
    const expectedAssets = [
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
        if (apiPath === `/repos/${owner}/${repo}/releases/latest`) {
          const responseBody = {
            "assets": expectedAssets
          };

          return Promise.resolve(new fetch.Response(JSON.stringify(responseBody)));
        }
        return Promise.reject(new Error(`Unknown API path: ${apiPath}`));
      }
    }

    const consumer = new MockReleasesApiConsumer(owner, repo);

    const assets = (await consumer.getLatestRelease()).assets;

    expect(assets.length).to.equal(expectedAssets.length);
    expectedAssets.map((expectedAsset, index) => {
      expect(assets[index].id).to.equal(expectedAsset.id);
      expect(assets[index].name).to.equal(expectedAsset.name);
      expect(assets[index].size).to.equal(expectedAsset.size);
    });
  });
});
