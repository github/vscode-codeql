import { load } from "js-yaml";
import { readFile } from "fs-extra";

import { getErrorMessage } from "../../../../../src/common/helpers-pure";

import * as log from "../../../../../src/common/logging/notifications";
import * as workspaceFolders from "../../../../../src/common/vscode/workspace-folders";
import {
  KeyType,
  resolveContextualQlPacksForDatabase,
  resolveContextualQueries,
} from "../../../../../src/language-support";
import type {
  CodeQLCliServer,
  DbInfo,
} from "../../../../../src/codeql-cli/cli";
import { mockedObject } from "../../../utils/mocking.helpers";
import * as queryResolver from "../../../../../src/local-queries/query-resolver";
import type { DatabaseItem } from "../../../../../src/databases/local-databases";
import { Uri } from "vscode";

describe("queryResolver", () => {
  let qlpackOfDatabase: jest.SpiedFunction<
    typeof queryResolver.qlpackOfDatabase
  >;

  const resolveQueriesInSuite: jest.MockedFunction<
    typeof CodeQLCliServer.prototype.resolveQueriesInSuite
  > = jest.fn();
  const resolveDatabase: jest.MockedFunction<
    typeof CodeQLCliServer.prototype.resolveDatabase
  > = jest.fn();
  const packDownload: jest.MockedFunction<
    typeof CodeQLCliServer.prototype.packDownload
  > = jest.fn();

  const mockCli = mockedObject<CodeQLCliServer>({
    resolveQueriesInSuite,
    resolveDatabase,
    packDownload,
  });

  beforeEach(() => {
    qlpackOfDatabase = jest.spyOn(queryResolver, "qlpackOfDatabase");

    jest
      .spyOn(workspaceFolders, "getOnDiskWorkspaceFolders")
      .mockReturnValue([]);
    jest.spyOn(log, "showAndLogErrorMessage").mockResolvedValue(undefined);
  });

  describe("resolveContextualQlPacksForDatabase", () => {
    let databaseItem: DatabaseItem;

    beforeEach(() => {
      databaseItem = {
        name: "my-db",
        language: "csharp",
        databaseUri: Uri.file("/a/b/c/db"),
      } as DatabaseItem;
    });

    it("should resolve a qlpack when CLI returns qlpack", async () => {
      qlpackOfDatabase.mockResolvedValue({
        dbschemePack: "dbschemePack",
        dbschemePackIsLibraryPack: false,
      });

      expect(
        await resolveContextualQlPacksForDatabase(mockCli, databaseItem),
      ).toEqual({
        dbschemePack: "dbschemePack",
        dbschemePackIsLibraryPack: false,
      });
    });

    it("should return qlpack when downloading packs", async () => {
      qlpackOfDatabase.mockRejectedValue(new Error("error"));
      resolveDatabase.mockResolvedValue({
        languages: ["csharp"],
      } as DbInfo);

      expect(
        await resolveContextualQlPacksForDatabase(mockCli, databaseItem),
      ).toEqual({
        dbschemePack: "codeql/csharp-all",
        dbschemePackIsLibraryPack: true,
        queryPack: "codeql/csharp-queries",
      });
      expect(packDownload).toHaveBeenCalledTimes(1);
      expect(packDownload).toHaveBeenCalledWith([
        "codeql/csharp-all",
        "codeql/csharp-queries",
      ]);
    });
  });

  describe("resolveContextualQueries", () => {
    it("should resolve a query", async () => {
      resolveQueriesInSuite.mockResolvedValue(["a", "b"]);
      const result = await resolveContextualQueries(
        mockCli,
        { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
        KeyType.DefinitionQuery,
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
            kind: "definitions",
            "tags contain": ["ide-contextual-queries/local-definitions"],
          },
        },
      ]);
    });

    it("should throw an error when there are no queries found", async () => {
      resolveQueriesInSuite.mockResolvedValue([]);

      try {
        await resolveContextualQueries(
          mockCli,
          { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
          KeyType.DefinitionQuery,
        );
        // should reject
        expect(true).toBe(false);
      } catch (e) {
        expect(getErrorMessage(e)).toBe(
          'No definitions queries (kind "definitions", tagged "ide-contextual-queries/local-definitions") could be found in the current library path (tried searching the following packs: my-qlpack). Try upgrading the CodeQL libraries. If that doesn\'t work, then definitions queries are not yet available for this language.',
        );
      }
    });
  });
});
