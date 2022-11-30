import * as path from "path";
import { extensions } from "vscode";

import { CodeQLCliServer } from "../../cli";
import { CodeQLExtensionInterface } from "../../extension";
import { tryGetQueryMetadata } from "../../helpers";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("helpers (with CLI)", () => {
  const baseDir = path.join(
    __dirname,
    "../../../src/vscode-tests/cli-integration",
  );

  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
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
      path.join(baseDir, "data", "simple-javascript-query.ql"),
    );

    expect(metadata!.name).toBe("This is the name");
    expect(metadata!.kind).toBe("problem");
    expect(metadata!.id).toBe("javascript/example/test-query");
  });

  it("should handle query with no metadata", async () => {
    // Query with empty metadata
    const noMetadata = await tryGetQueryMetadata(
      cli,
      path.join(baseDir, "data", "simple-query.ql"),
    );

    expect(noMetadata).toEqual({});
  });
});
