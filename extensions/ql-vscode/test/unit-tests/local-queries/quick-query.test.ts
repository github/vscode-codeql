import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { pathExists, readFile, writeFile } from "fs-extra";
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

  it("preserves existing query files across repeated calls", async () => {
    const app = createMockApp({ workspaceStoragePath: dir.name });
    const quickQueriesDir = await getQuickQueriesDir(app);
    const queryPath = join(quickQueriesDir, "quick-query.ql");
    await writeFile(queryPath, "select 1");

    expect(await getQuickQueriesDir(app)).toBe(quickQueriesDir);
    expect(await readFile(queryPath, "utf8")).toBe("select 1");
  });

  it("propagates an error when the storage path is a file", async () => {
    const storagePath = join(dir.name, "not-a-directory");
    await writeFile(storagePath, "existing file");
    const app = createMockApp({ workspaceStoragePath: storagePath });

    await expect(getQuickQueriesDir(app)).rejects.toThrow();
    expect(await readFile(storagePath, "utf8")).toBe("existing file");
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
