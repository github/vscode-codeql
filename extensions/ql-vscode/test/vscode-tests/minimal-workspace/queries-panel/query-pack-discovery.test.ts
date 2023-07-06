import { Uri, workspace } from "vscode";
import { QueryPackDiscovery } from "../../../../src/queries-panel/query-pack-discovery";
import * as tmp from "tmp";
import { dirname, join } from "path";
import { CodeQLCliServer, QuerySetup } from "../../../../src/codeql-cli/cli";
import { mockedObject } from "../../utils/mocking.helpers";
import { mkdirSync, writeFileSync } from "fs";

describe("Query pack discovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspacePath: string;

  let resolveLibraryPath: jest.SpiedFunction<
    typeof CodeQLCliServer.prototype.resolveLibraryPath
  >;
  let discovery: QueryPackDiscovery;

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

    const mockResolveLibraryPathValue: QuerySetup = {
      libraryPath: [],
      dbscheme: "/ql/java/ql/lib/config/semmlecode.dbscheme",
    };
    resolveLibraryPath = jest
      .fn()
      .mockResolvedValue(mockResolveLibraryPathValue);
    const mockCliServer = mockedObject<CodeQLCliServer>({ resolveLibraryPath });
    discovery = new QueryPackDiscovery(mockCliServer);
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
    discovery.dispose();
  });

  describe("findQueryPack", () => {
    it("returns undefined when there are no query packs", async () => {
      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual(undefined);
    });

    it("locates a query pack in the same directory", async () => {
      makeTestFile(join(workspacePath, "qlpack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("java");
    });

    it("locates a query pack using the old pack name", async () => {
      makeTestFile(join(workspacePath, "codeql-pack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("java");
    });

    it("locates a query pack in a higher directory", async () => {
      makeTestFile(join(workspacePath, "qlpack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(
          join(workspacePath, "foo", "bar", "query.ql"),
        ),
      ).toEqual("java");
    });

    it("doesn't recognise a query pack in a sibling directory", async () => {
      makeTestFile(join(workspacePath, "foo", "qlpack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(
          join(workspacePath, "foo", "query.ql"),
        ),
      ).toEqual("java");
      expect(
        discovery.getLanguageForQueryFile(
          join(workspacePath, "bar", "query.ql"),
        ),
      ).toEqual(undefined);
    });

    it("query packs override those from parent directories", async () => {
      makeTestFile(join(workspacePath, "qlpack.yml"));
      makeTestFile(join(workspacePath, "foo", "qlpack.yml"));

      resolveLibraryPath.mockImplementation(async (_workspaces, queryPath) => {
        if (queryPath === join(workspacePath, "qlpack.yml")) {
          return {
            libraryPath: [],
            dbscheme: "/ql/java/ql/lib/config/semmlecode.dbscheme",
          };
        }
        if (queryPath === join(workspacePath, "foo", "qlpack.yml")) {
          return {
            libraryPath: [],
            dbscheme: "/ql/cpp/ql/lib/semmlecode.cpp.dbscheme",
          };
        }
        throw new Error(`Unknown query pack: ${queryPath}`);
      });

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("java");
      expect(
        discovery.getLanguageForQueryFile(
          join(workspacePath, "foo", "query.ql"),
        ),
      ).toEqual("cpp");
    });

    it("prefers a query pack called qlpack.yml", async () => {
      makeTestFile(join(workspacePath, "qlpack.yml"));
      makeTestFile(join(workspacePath, "codeql-pack.yml"));

      resolveLibraryPath.mockImplementation(async (_workspaces, queryPath) => {
        if (queryPath === join(workspacePath, "qlpack.yml")) {
          return {
            libraryPath: [],
            dbscheme: "/ql/cpp/ql/lib/semmlecode.cpp.dbscheme",
          };
        }
        if (queryPath === join(workspacePath, "codeql-pack.yml")) {
          return {
            libraryPath: [],
            dbscheme: "/ql/java/ql/lib/config/semmlecode.dbscheme",
          };
        }
        throw new Error(`Unknown query pack: ${queryPath}`);
      });

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("cpp");
    });
  });
});

function makeTestFile(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "");
}
