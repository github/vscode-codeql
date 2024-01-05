import { Uri, workspace } from "vscode";
import { QueryPackDiscovery } from "../../../../src/queries-panel/query-pack-discovery";
import { dirSync } from "tmp";
import { dirname, join } from "path";
import { ensureDir, writeJSON } from "fs-extra";
import { QueryLanguage } from "../../../../src/common/query-language";

describe("Query pack discovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspacePath: string;

  let discovery: QueryPackDiscovery;

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

    discovery = new QueryPackDiscovery();
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
      await makeTestFile(join(workspacePath, "qlpack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("java");
    });

    it("locates a query pack using the old pack name", async () => {
      await makeTestFile(join(workspacePath, "codeql-pack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("java");
    });

    it("locates a query pack in a higher directory", async () => {
      await makeTestFile(join(workspacePath, "qlpack.yml"));

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(
          join(workspacePath, "foo", "bar", "query.ql"),
        ),
      ).toEqual("java");
    });

    it("doesn't recognise a query pack in a sibling directory", async () => {
      await makeTestFile(join(workspacePath, "foo", "qlpack.yml"));

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
      await makeTestFile(join(workspacePath, "qlpack.yml"), QueryLanguage.Java);
      await makeTestFile(
        join(workspacePath, "foo", "qlpack.yml"),
        QueryLanguage.Cpp,
      );

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
      await makeTestFile(join(workspacePath, "qlpack.yml"), QueryLanguage.Cpp);
      await makeTestFile(
        join(workspacePath, "codeql-pack.yml"),
        QueryLanguage.Java,
      );

      await discovery.initialRefresh();

      expect(
        discovery.getLanguageForQueryFile(join(workspacePath, "query.ql")),
      ).toEqual("cpp");
    });
  });
});

async function makeTestFile(
  path: string,
  language: QueryLanguage = QueryLanguage.Java,
) {
  await ensureDir(dirname(path));
  await writeJSON(path, {
    dependencies: {
      [`codeql/${language}-all`]: "*",
    },
  });
}
