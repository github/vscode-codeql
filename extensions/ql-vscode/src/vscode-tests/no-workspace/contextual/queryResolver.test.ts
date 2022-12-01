import { load } from "js-yaml";
import * as fs from "fs-extra";

import { KeyType } from "../../../contextual/keyType";
import { getErrorMessage } from "../../../pure/helpers-pure";

import * as helpers from "../../../helpers";
import {
  qlpackOfDatabase,
  resolveQueries,
} from "../../../contextual/queryResolver";
import { CodeQLCliServer } from "../../../cli";
import { DatabaseItem } from "../../../databases";

describe("queryResolver", () => {
  let writeFileSpy: jest.SpiedFunction<typeof fs.writeFile>;

  let getQlPackForDbschemeSpy: jest.SpiedFunction<
    typeof helpers.getQlPackForDbscheme
  >;
  let getPrimaryDbschemeSpy: jest.SpiedFunction<
    typeof helpers.getPrimaryDbscheme
  >;

  const mockCli = {
    resolveQueriesInSuite: jest.fn(),
    cliConstraints: {
      supportsAllowLibraryPacksInResolveQueries: jest.fn(),
    },
  };

  beforeEach(() => {
    writeFileSpy = jest
      .spyOn(fs, "writeFile")
      .mockImplementation(() => Promise.resolve());

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

    mockCli.cliConstraints.supportsAllowLibraryPacksInResolveQueries.mockReturnValue(
      true,
    );
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
      expect(writeFileSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/.qls$/),
        expect.anything(),
        expect.anything(),
      );
      expect(load(writeFileSpy.mock.calls[0][1])).toEqual([
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

    it("should resolve a query from the queries pack if this is an old CLI", async () => {
      // pretend this is an older CLI
      mockCli.cliConstraints.supportsAllowLibraryPacksInResolveQueries.mockReturnValue(
        false,
      );
      mockCli.resolveQueriesInSuite.mockReturnValue(["a", "b"]);
      const result = await resolveQueries(
        mockCli as unknown as CodeQLCliServer,
        {
          dbschemePackIsLibraryPack: true,
          dbschemePack: "my-qlpack",
          queryPack: "my-qlpack2",
        },
        KeyType.DefinitionQuery,
      );
      expect(result).toEqual(["a", "b"]);
      expect(writeFileSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/.qls$/),
        expect.anything(),
        expect.anything(),
      );
      expect(load(writeFileSpy.mock.calls[0][1])).toEqual([
        {
          from: "my-qlpack2",
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
          "Couldn't find any queries tagged ide-contextual-queries/local-definitions in any of the following packs: my-qlpack.",
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
