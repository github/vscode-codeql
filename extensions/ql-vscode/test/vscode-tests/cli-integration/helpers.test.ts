import { join } from "path";

import { CodeQLCliServer } from "../../../src/cli";
import { tryGetQueryMetadata } from "../../../src/helpers";
import { getActivatedExtension } from "../global.helper";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("helpers (with CLI)", () => {
  const baseDir = __dirname;

  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    if ("cliServer" in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }
  });

  it("should get query metadata when available", async () => {
    // Query with metadata
    const metadata = await tryGetQueryMetadata(
      cli,
      join(baseDir, "data", "simple-javascript-query.ql"),
    );

    expect(metadata!.name).toBe("This is the name");
    expect(metadata!.kind).toBe("problem");
    expect(metadata!.id).toBe("javascript/example/test-query");
  });

  it("should handle query with no metadata", async () => {
    // Query with empty metadata
    const noMetadata = await tryGetQueryMetadata(
      cli,
      join(baseDir, "data", "simple-query.ql"),
    );

    expect(noMetadata).toEqual({});
  });
});
