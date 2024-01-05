import { join, resolve } from "path";

import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension } from "../../global.helper";
import { tryGetQueryMetadata } from "../../../../src/codeql-cli/query-metadata";
import { getDataFolderFilePath } from "../utils";

describe("tryGetQueryMetadata", () => {
  const baseDir = resolve(__dirname, "..");

  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    cli = extension.cliServer;
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
      getDataFolderFilePath("debugger/simple-query.ql"),
    );

    expect(noMetadata).toEqual({});
  });
});
