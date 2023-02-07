import { load } from "js-yaml";
import * as fs from "fs-extra";

import { KeyType } from "../../../../src/contextual/keyType";
import { getErrorMessage } from "../../../../src/pure/helpers-pure";

import * as helpers from "../../../../src/helpers";
import {
  qlpackOfDatabase,
  resolveQueries,
} from "../../../../src/contextual/queryResolver";
import { CodeQLCliServer } from "../../../../src/cli";
import { DatabaseItem } from "../../../../src/databases";

describe("queryResolver", () => {
  let getQlPackForDbschemeSpy: jest.SpiedFunction<
    typeof helpers.getQlPackForDbscheme
  >;
  let getPrimaryDbschemeSpy: jest.SpiedFunction<
    typeof helpers.getPrimaryDbscheme
  >;

  const mockCli = {
    resolveQueriesInSuite: jest.fn(),
  };

  beforeEach(() => {
    getQlPackForDbschemeSpy = jest
      .spyOn(helpers, "getQlPackForDbscheme")
      .mockResolvedValue({
        dbschemePack: "dbschemePack",
        dbschemePackIsLibraryPack: false,
      });
    getPrimaryDbschemeSpy = jest
      .spyOn(helpers, "getPrimaryDbscheme")
      .mockResolvedValue("primaryDbscheme");

    jest.spyOn(helpers, "getOnDiskWorkspaceFolders").mockReturnValue([]);
    jest.spyOn(helpers, "showAndLogErrorMessage").mockResolvedValue(undefined);
  });

  describe("resolveQueries", () => {
    it("should resolve a query", async () => {
      mockCli.resolveQueriesInSuite.mockReturnValue(["a", "b"]);
      const result = await resolveQueries(
        mockCli as unknown as CodeQLCliServer,
        { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
        KeyType.DefinitionQuery,
      );
      expect(result).toEqual(["a", "b"]);

      expect(mockCli.resolveQueriesInSuite).toHaveBeenCalledWith(
        expect.stringMatching(/\.qls$/),
        [],
      );

      const fileName = mockCli.resolveQueriesInSuite.mock.calls[0][0];

      expect(load(await fs.readFile(fileName, "utf-8"))).toEqual([
        {
          from: "my-qlpack",
          queries: ".",
          include: {
            kind: "definitions",
            "tags contain": "ide-contextual-queries/local-definitions",
          },
        },
      ]);
    });

    it("should throw an error when there are no queries found", async () => {
      mockCli.resolveQueriesInSuite.mockReturnValue([]);

      try {
        await resolveQueries(
          mockCli as unknown as CodeQLCliServer,
          { dbschemePack: "my-qlpack", dbschemePackIsLibraryPack: false },
          KeyType.DefinitionQuery,
        );
        // should reject
        expect(true).toBe(false);
      } catch (e) {
        expect(getErrorMessage(e)).toBe(
          'No definitions queries (tagged "ide-contextual-queries/local-definitions") could be found in the current library path (tried searching the following packs: my-qlpack). Try upgrading the CodeQL libraries. If that doesn\'t work, then definitions queries are not yet available for this language.',
        );
      }
    });
  });

  describe("qlpackOfDatabase", () => {
    it("should get the qlpack of a database", async () => {
      getQlPackForDbschemeSpy.mockResolvedValue({
        dbschemePack: "my-qlpack",
        dbschemePackIsLibraryPack: false,
      });
      const db = {
        contents: {
          datasetUri: {
            fsPath: "/path/to/database",
          },
        },
      } as unknown as DatabaseItem;
      const result = await qlpackOfDatabase(
        mockCli as unknown as CodeQLCliServer,
        db,
      );
      expect(result).toEqual({
        dbschemePack: "my-qlpack",
        dbschemePackIsLibraryPack: false,
      });
      expect(getPrimaryDbschemeSpy).toBeCalledWith("/path/to/database");
    });
  });
});
