import { createMockApp } from "../../../__mocks__/appMock";
import type { QueryPackDiscoverer } from "../../../../src/query-testing/qltest-file-discovery";
import { QLTestFileDiscovery } from "../../../../src/query-testing/qltest-file-discovery";
import { EventEmitter, Uri, workspace } from "vscode";
import { dirSync } from "tmp";
import { join } from "path";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { outputFile } from "fs-extra";
import { containsPath } from "../../../../src/common/files";

describe("QLTest file discovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspacePath: string;

  const app = createMockApp({});
  const env = app.environment;

  const getTestsPathForFile = jest.fn();
  const onDidChangeQueryPacks = new EventEmitter<void>();

  let queryPackDiscoverer: QueryPackDiscoverer;
  let discovery: QLTestFileDiscovery;

  beforeEach(async () => {
    const t = dirSync({
      unsafeCleanup: true,
    });
    tmpDir = t.name;
    tmpDirRemoveCallback = t.removeCallback;

    const workspaceFolder = {
      uri: Uri.file(join(tmpDir, "workspace")),
      name: "workspace",
      index: 0,
    };
    workspacePath = workspaceFolder.uri.fsPath;
    jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder]);

    queryPackDiscoverer = {
      getTestsPathForFile,
      onDidChangeQueryPacks: onDidChangeQueryPacks.event,
    };
    discovery = new QLTestFileDiscovery(app, queryPackDiscoverer);
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
    discovery.dispose();
  });

  describe("buildTestTree", () => {
    it("returns undefined before initial refresh has been done", async () => {
      expect(discovery.buildTestTree()).toEqual(undefined);
    });

    it("returns an empty tree when there are no test files", async () => {
      await makeTestFile(join(workspacePath, "my-query.expected"));
      await makeTestFile(join(workspacePath, "__test-query.qlref"));

      await discovery.initialRefresh();

      expect(discovery.buildTestTree()).toEqual([]);
    });

    it("handles when no tests directory is defined and expected file does not exist", async () => {
      await makeTestFile(join(workspacePath, "query.qlref"));

      await discovery.initialRefresh();

      expect(discovery.buildTestTree()).toEqual([]);
    });

    it("handles when no tests directory is defined and expected file exists", async () => {
      await makeTestFile(join(workspacePath, "query.qlref"));
      await makeTestFile(join(workspacePath, "query.expected"));

      await discovery.initialRefresh();

      expect(discovery.buildTestTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(join(workspacePath, "query.qlref"), "query.qlref"),
        ]),
      ]);
    });

    it("handles mix of tests directory and non-tests directory with collapsed directory structure", async () => {
      await makeTestFile(join(workspacePath, "query.qlref"));
      await makeTestFile(join(workspacePath, "query.expected"));

      await makeTestFile(
        join(workspacePath, "my-query-pack", "lib", "query.ql"),
      );
      await makeTestFile(
        join(workspacePath, "my-query-pack", "lib", "query.expected"),
      );
      await makeTestFile(
        join(workspacePath, "my-query-pack", "test", "query.qlref"),
      );

      await makeTestFile(
        join(workspacePath, "packs", "another-query-pack", "lib", "query.ql"),
      );
      await makeTestFile(
        join(
          workspacePath,
          "packs",
          "another-query-pack",
          "test",
          "query.qlref",
        ),
      );
      await makeTestFile(
        join(
          workspacePath,
          "packs",
          "yet-another-query-pack",
          "tests",
          "query.qlref",
        ),
      );

      getTestsPathForFile.mockImplementation((path) => {
        if (containsPath(join(workspacePath, "my-query-pack"), path)) {
          return join(workspacePath, "my-query-pack", "test");
        }
        if (
          containsPath(join(workspacePath, "packs", "another-query-pack"), path)
        ) {
          return join(workspacePath, "packs", "another-query-pack", "test");
        }
        if (
          containsPath(
            join(workspacePath, "packs", "yet-another-query-pack"),
            path,
          )
        ) {
          return join(
            workspacePath,
            "packs",
            "yet-another-query-pack",
            "tests",
          );
        }

        return undefined;
      });

      await discovery.initialRefresh();

      expect(discovery.buildTestTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeDirectory(
            join(workspacePath, "my-query-pack/test"),
            "my-query-pack / test",
            env,
            [
              new FileTreeLeaf(
                join(workspacePath, "my-query-pack", "test", "query.qlref"),
                "query.qlref",
              ),
            ],
          ),
          new FileTreeDirectory(join(workspacePath, "packs"), "packs", env, [
            new FileTreeDirectory(
              join(workspacePath, "packs", "another-query-pack", "test"),
              "another-query-pack / test",
              env,
              [
                new FileTreeLeaf(
                  join(
                    workspacePath,
                    "packs",
                    "another-query-pack",
                    "test",
                    "query.qlref",
                  ),
                  "query.qlref",
                ),
              ],
            ),
            new FileTreeDirectory(
              join(workspacePath, "packs", "yet-another-query-pack", "tests"),
              "yet-another-query-pack / tests",
              env,
              [
                new FileTreeLeaf(
                  join(
                    workspacePath,
                    "packs",
                    "yet-another-query-pack",
                    "tests",
                    "query.qlref",
                  ),
                  "query.qlref",
                ),
              ],
            ),
          ]),
          new FileTreeLeaf(join(workspacePath, "query.qlref"), "query.qlref"),
        ]),
      ]);
    });

    it("ignores .testproj directory when named correctly", async () => {
      await makeTestFile(
        join(
          workspacePath,
          "my-query-pack",
          "test",
          "my-query-pack",
          "query.qlref",
        ),
      );
      await makeTestFile(
        join(
          workspacePath,
          "my-query-pack",
          "test",
          "my-query-pack",
          "my-query-pack.testproj",
          "query.ql",
        ),
      );

      getTestsPathForFile.mockImplementation((path) => {
        if (containsPath(join(workspacePath, "my-query-pack"), path)) {
          return join(workspacePath, "my-query-pack", "test");
        }

        return undefined;
      });

      await discovery.initialRefresh();

      expect(discovery.buildTestTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeDirectory(
            join(workspacePath, "my-query-pack", "test", "my-query-pack"),
            "my-query-pack / test / my-query-pack",
            env,
            [
              new FileTreeLeaf(
                join(
                  workspacePath,
                  "my-query-pack",
                  "test",
                  "my-query-pack",
                  "query.qlref",
                ),
                "query.qlref",
              ),
            ],
          ),
        ]),
      ]);
    });
  });
});

async function makeTestFile(path: string) {
  await outputFile(path, "");
}
