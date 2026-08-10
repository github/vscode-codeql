import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { pathExists } from "fs-extra";
import { join } from "path";
import { createMockApp } from "../../__mocks__/appMock";
import { getQuickQueriesDir } from "../../../src/local-queries/quick-query-dir";

describe("getQuickQueriesDir", () => {
  let dir: DirResult;

  beforeEach(() => {
    dir = dirSync({
      unsafeCleanup: true,
    });
  });

  afterEach(() => {
    dir.removeCallback();
  });

  it("uses global storage when no workspace is open", async () => {
    const app = {
      ...createMockApp({ globalStoragePath: dir.name }),
      workspaceStoragePath: undefined,
    };

    const quickQueriesDir = await getQuickQueriesDir(app);

    expect(quickQueriesDir).toBe(join(dir.name, "quick-queries"));
    expect(await pathExists(quickQueriesDir)).toBe(true);
  });

  it("prefers workspace storage when a workspace is open", async () => {
    const workspaceStoragePath = join(dir.name, "workspace-storage");
    const app = createMockApp({
      workspaceStoragePath,
      globalStoragePath: dir.name,
    });

    const quickQueriesDir = await getQuickQueriesDir(app);

    expect(quickQueriesDir).toBe(join(workspaceStoragePath, "quick-queries"));
    expect(await pathExists(quickQueriesDir)).toBe(true);
  });
});
