import * as path from "path";
import { extensions } from "vscode";

import { CodeQLCliServer } from "../../cli";
import { CodeQLExtensionInterface } from "../../extension";
import { tryGetQueryMetadata } from "../../helpers";
import { expect } from "chai";

describe("helpers (with CLI)", function () {
  const baseDir = path.join(
    __dirname,
    "../../../src/vscode-tests/cli-integration",
  );

  // up to 3 minutes per test
  this.timeout(3 * 60 * 1000);

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

    expect(metadata!.name).to.equal("This is the name");
    expect(metadata!.kind).to.equal("problem");
    expect(metadata!.id).to.equal("javascript/example/test-query");
  });

  it("should handle query with no metadata", async () => {
    // Query with empty metadata
    const noMetadata = await tryGetQueryMetadata(
      cli,
      path.join(baseDir, "data", "simple-query.ql"),
    );

    expect(noMetadata).to.deep.equal({});
  });
});
