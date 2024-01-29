import {
  qlpackOfDatabase,
  resolveQueriesByLanguagePack,
} from "../../../../src/local-queries";
import { mockDatabaseItem, mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import * as qlpack from "../../../../src/databases/qlpack";
import * as workspaceFolders from "../../../../src/common/vscode/workspace-folders";
import * as log from "../../../../src/common/logging/notifications";
import { load } from "js-yaml";
import { readFile } from "fs-extra";

describe("qlpackOfDatabase", () => {
  let getQlPackForDbschemeSpy: jest.SpiedFunction<
    typeof qlpack.getQlPackForDbscheme
  >;
  let getPrimaryDbschemeSpy: jest.SpiedFunction<
    typeof qlpack.getPrimaryDbscheme
  >;

  const mockCli = mockedObject<CodeQLCliServer>({});

  beforeEach(() => {
    getQlPackForDbschemeSpy = jest
      .spyOn(qlpack, "getQlPackForDbscheme")
      .mockResolvedValue({
        dbschemePack: "dbschemePack",
        dbschemePackIsLibraryPack: false,
      });
    getPrimaryDbschemeSpy = jest
      .spyOn(qlpack, "getPrimaryDbscheme")
      .mockResolvedValue("primaryDbscheme");
  });

  it("should get the qlpack of a database", async () => {
    getQlPackForDbschemeSpy.mockResolvedValue({
      dbschemePack: "my-qlpack",
      dbschemePackIsLibraryPack: false,
    });
    const db = mockDatabaseItem({
      contents: {
        datasetUri: {
          fsPath: "/path/to/database",
        },
      },
    });
    const result = await qlpackOfDatabase(mockCli, db);
    expect(result).toEqual({
      dbschemePack: "my-qlpack",
      dbschemePackIsLibraryPack: false,
    });
    expect(getPrimaryDbschemeSpy).toHaveBeenCalledWith("/path/to/database");
  });
});

describe("resolveQueries", () => {
  const resolveQueriesInSuite = jest.fn();

  const mockCli = mockedObject<CodeQLCliServer>({
    resolveQueriesInSuite,
  });

  beforeEach(() => {
    jest
      .spyOn(workspaceFolders, "getOnDiskWorkspaceFolders")
      .mockReturnValue([]);
    jest.spyOn(log, "showAndLogErrorMessage").mockResolvedValue(undefined);
  });

  it("should resolve a query", async () => {
    resolveQueriesInSuite.mockReturnValue(["a", "b"]);
    const result = await resolveQueriesByLanguagePack(
      mockCli,
      { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
      "my query",
      {
        kind: "graph",
        "tags contain": ["ide-contextual-queries/print-ast"],
      },
    );
    expect(result).toEqual(["a", "b"]);

    expect(resolveQueriesInSuite).toHaveBeenCalledWith(
      expect.stringMatching(/\.qls$/),
      [],
    );

    const fileName = resolveQueriesInSuite.mock.calls[0][0];

    expect(load(await readFile(fileName, "utf-8"))).toEqual([
      {
        from: "my-qlpack",
        queries: ".",
        include: {
          kind: "graph",
          "tags contain": ["ide-contextual-queries/print-ast"],
        },
      },
    ]);
  });

  it("should throw an error when there are no queries found", async () => {
    resolveQueriesInSuite.mockReturnValue([]);

    await expect(
      resolveQueriesByLanguagePack(
        mockCli,
        { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
        "my query",
        {
          kind: "graph",
          "tags contain": ["ide-contextual-queries/print-ast"],
        },
      ),
    ).rejects.toThrow(
      'No my query queries (kind "graph", tagged "ide-contextual-queries/print-ast") could be found in the current library path (tried searching the following packs: my-qlpack). Try upgrading the CodeQL libraries. If that doesn\'t work, then my query queries are not yet available for this language.',
    );
  });
});
