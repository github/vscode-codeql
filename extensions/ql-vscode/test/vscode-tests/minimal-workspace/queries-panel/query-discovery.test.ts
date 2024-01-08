import { EventEmitter, Uri, workspace } from "vscode";
import type { QueryPackDiscoverer } from "../../../../src/queries-panel/query-discovery";
import { QueryDiscovery } from "../../../../src/queries-panel/query-discovery";
import { createMockApp } from "../../../__mocks__/appMock";
import { basename, dirname, join } from "path";
import { dirSync } from "tmp";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { mkdirSync, writeFileSync } from "fs";
import { QueryLanguage } from "../../../../src/common/query-language";
import { sleep } from "../../../../src/common/time";
import { LanguageContextStore } from "../../../../src/language-context-store";

describe("Query pack discovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspacePath: string;

  const app = createMockApp({});
  const env = app.environment;

  const languageContext = new LanguageContextStore(app);

  const onDidChangeQueryPacks = new EventEmitter<void>();
  let queryPackDiscoverer: QueryPackDiscoverer;
  let discovery: QueryDiscovery;

  beforeEach(() => {
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
      getLanguageForQueryFile: () => QueryLanguage.Java,
      onDidChangeQueryPacks: onDidChangeQueryPacks.event,
    };
    discovery = new QueryDiscovery(app, queryPackDiscoverer, languageContext);
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
    discovery.dispose();
  });

  describe("buildQueryTree", () => {
    it("returns undefined before initial refresh has been done", async () => {
      expect(discovery.buildQueryTree()).toEqual(undefined);
    });

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

    it("should respect the language context filter", async () => {
      makeTestFile(join(workspacePath, "query1.ql"));
      makeTestFile(join(workspacePath, "query2.ql"));

      queryPackDiscoverer.getLanguageForQueryFile = (path) => {
        if (basename(path) === "query1.ql") {
          return QueryLanguage.Java;
        } else {
          return QueryLanguage.Python;
        }
      };

      await discovery.initialRefresh();

      // Set the language to python-only
      await languageContext.setLanguageContext(QueryLanguage.Python);

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(
            join(workspacePath, "query2.ql"),
            "query2.ql",
            "python",
          ),
        ]),
      ]);

      // Clear the language context filter
      await languageContext.clearLanguageContext();

      expect(discovery.buildQueryTree()).toEqual([
        new FileTreeDirectory(workspacePath, "workspace", env, [
          new FileTreeLeaf(
            join(workspacePath, "query1.ql"),
            "query1.ql",
            "java",
          ),
          new FileTreeLeaf(
            join(workspacePath, "query2.ql"),
            "query2.ql",
            "python",
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

      queryPackDiscoverer.getLanguageForQueryFile = () => QueryLanguage.Python;
      onDidChangeQueryPacks.fire();

      // Wait for the query discovery to recompute the query languages.
      // This is async but should complete instantly since it's all in-memory.
      await sleep(100);

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
