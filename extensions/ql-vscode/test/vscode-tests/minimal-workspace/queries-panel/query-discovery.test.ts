import { EventEmitter, Uri, workspace } from "vscode";
import {
  QueryDiscovery,
  QueryPackDiscoverer,
} from "../../../../src/queries-panel/query-discovery";
import { createMockEnvironmentContext } from "../../../__mocks__/appMock";
import { dirname, join } from "path";
import * as tmp from "tmp";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { mkdirSync, writeFileSync } from "fs";

describe("Query pack discovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspacePath: string;

  const env = createMockEnvironmentContext();

  const onDidChangeQueryPacks = new EventEmitter<void>();
  let queryPackDiscoverer: QueryPackDiscoverer;
  let discovery: QueryDiscovery;

  beforeEach(() => {
    const t = tmp.dirSync();
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
      getLanguageForQueryFile: () => "java",
      onDidChangeQueryPacks: onDidChangeQueryPacks.event,
    };
    discovery = new QueryDiscovery(env, queryPackDiscoverer);
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
    discovery.dispose();
  });

  describe("buildQueryTree", () => {
    it("returns an empty tree when there are no query files", async () => {
      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([]);
    });

    it("handles when query pack data is available", async () => {
      makeTestFile(join(workspacePath, "query.ql"));

      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(join(workspacePath, "query.ql"), "query.ql", "java"),
        ]),
      ]);
    });

    it("handles when query pack data is not available", async () => {
      makeTestFile(join(workspacePath, "query.ql"));

      queryPackDiscoverer.getLanguageForQueryFile = () => undefined;

      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(
            join(workspacePath, "query.ql"),
            "query.ql",
            undefined,
          ),
        ]),
      ]);
    });

    it("should organise query files into directories", async () => {
      makeTestFile(join(workspacePath, "dir1", "query1.ql"));
      makeTestFile(join(workspacePath, "dir1", "query2.ql"));
      makeTestFile(join(workspacePath, "dir2", "query3.ql"));
      makeTestFile(join(workspacePath, "query4.ql"));

      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeDirectory(join(workspacePath, "dir1"), "dir1", env, [
            new FileTreeLeaf(
              join(workspacePath, "dir1", "query1.ql"),
              "query1.ql",
              "java",
            ),
            new FileTreeLeaf(
              join(workspacePath, "dir1", "query2.ql"),
              "query2.ql",
              "java",
            ),
          ]),
          new FileTreeDirectory(join(workspacePath, "dir2"), "dir2", env, [
            new FileTreeLeaf(
              join(workspacePath, "dir2", "query3.ql"),
              "query3.ql",
              "java",
            ),
          ]),
          new FileTreeLeaf(
            join(workspacePath, "query4.ql"),
            "query4.ql",
            "java",
          ),
        ]),
      ]);
    });

    it("should collapse directories containing only a single element", async () => {
      makeTestFile(join(workspacePath, "query1.ql"));
      makeTestFile(join(workspacePath, "foo", "bar", "baz", "query2.ql"));

      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeDirectory(
            join(workspacePath, "foo", "bar", "baz"),
            "foo / bar / baz",
            env,
            [
              new FileTreeLeaf(
                join(workspacePath, "foo", "bar", "baz", "query2.ql"),
                "query2.ql",
                "java",
              ),
            ],
          ),
          new FileTreeLeaf(
            join(workspacePath, "query1.ql"),
            "query1.ql",
            "java",
          ),
        ]),
      ]);
    });
  });

  describe("recomputeAllQueryLanguages", () => {
    it("should recompute the language of all query files", async () => {
      makeTestFile(join(workspacePath, "query.ql"));

      await discovery.initialRefresh();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(join(workspacePath, "query.ql"), "query.ql", "java"),
        ]),
      ]);

      queryPackDiscoverer.getLanguageForQueryFile = () => "python";
      onDidChangeQueryPacks.fire();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(
            join(workspacePath, "query.ql"),
            "query.ql",
            "python",
          ),
        ]),
      ]);
    });
  });
});

function makeTestFile(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "");
}
