import { load } from "js-yaml";
import * as fs from "fs-extra";

import { getErrorMessage } from "../../../../../src/common/helpers-pure";

import * as log from "../../../../../src/common/logging/notifications";
import * as workspaceFolders from "../../../../../src/common/vscode/workspace-folders";
import { KeyType, resolveQueries } from "../../../../../src/language-support";
import { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("queryResolver", () => {
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

  describe("resolveQueries", () => {
    it("should resolve a query", async () => {
      resolveQueriesInSuite.mockReturnValue(["a", "b"]);
      const result = await resolveQueries(
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

      expect(load(await fs.readFile(fileName, "utf-8"))).toEqual([
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
      resolveQueriesInSuite.mockReturnValue([]);

      try {
        await resolveQueries(
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
