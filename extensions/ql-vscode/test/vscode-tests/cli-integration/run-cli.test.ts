import { authentication, Uri } from "vscode";
import { join } from "path";
import { SemVer } from "semver";

import type {
  CodeQLCliServer,
  QueryInfoByLanguage,
} from "../../../src/codeql-cli/cli";
import { itWithCodeQL } from "../cli";
import { getOnDiskWorkspaceFolders } from "../../../src/common/vscode/workspace-folders";
import {
  KeyType,
  resolveContextualQueries,
} from "../../../src/language-support";
import { faker } from "@faker-js/faker";
import { getActivatedExtension } from "../global.helper";
import type { BaseLogger } from "../../../src/common/logging";
import { getQlPackForDbscheme } from "../../../src/databases/qlpack";
import { dbSchemeToLanguage } from "../../../src/common/query-language";

/**
 * Perform proper integration tests by running the CLI
 */
describe("Use cli", () => {
  let cli: CodeQLCliServer;
  let supportedLanguages: string[];

  let logSpy: jest.SpiedFunction<BaseLogger["log"]>;

  const languageToDbScheme = Object.entries(dbSchemeToLanguage).reduce(
    (acc, [k, v]) => {
      acc[v] = k;
      return acc;
    },
    {} as { [k: string]: string },
  );

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    cli = extension.cliServer;
    supportedLanguages = await cli.getSupportedLanguages();

    logSpy = jest.spyOn(cli.logger, "log");
  });

  if (process.env.CLI_VERSION && process.env.CLI_VERSION !== "nightly") {
    it("should have the correct version of the cli", async () => {
      expect((await cli.getVersion()).toString()).toBe(
        new SemVer(process.env.CLI_VERSION || "").toString(),
      );
    });
  }

  it("should resolve ram", async () => {
    const result = await (cli as any).resolveRam(8192);
    expect(result.length).toEqual(2);
    expect(result[0]).toMatch(/^-J-Xmx\d+M$/);
    expect(result[1]).toMatch(/^--off-heap-ram=\d+$/);
  });

  describe("silent logging", () => {
    it("should log command output", async () => {
      const queryDir = getOnDiskWorkspaceFolders()[0];
      await cli.resolveQueries(queryDir);

      expect(logSpy).toHaveBeenCalled();
    });

    it("shouldn't log command output if the `silent` flag is set", async () => {
      const queryDir = getOnDiskWorkspaceFolders()[0];
      const silent = true;
      await cli.resolveQueries(queryDir, silent);

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  itWithCodeQL()("should resolve query packs", async () => {
    const qlpacks = await cli.resolveQlpacks(getOnDiskWorkspaceFolders());
    // Depending on the version of the CLI, the qlpacks may have different names
    // (e.g. "codeql/javascript-all" vs "codeql-javascript"),
    // so we just check that the expected languages are included.
    for (const expectedLanguage of supportedLanguages) {
      expect(Object.keys(qlpacks).includes(expectedLanguage));
    }
  });

  itWithCodeQL()("should support the expected languages", async () => {
    // Just check a few examples that definitely are/aren't supported.
    expect(supportedLanguages).toEqual(
      expect.arrayContaining(["go", "javascript", "python"]),
    );
    expect(supportedLanguages).not.toEqual(
      expect.arrayContaining(["xml", "properties"]),
    );
  });

  itWithCodeQL()("should resolve query by language", async () => {
    const queryPath = join(__dirname, "data", "simple-javascript-query.ql");
    const queryInfo: QueryInfoByLanguage = await cli.resolveQueryByLanguage(
      getOnDiskWorkspaceFolders(),
      Uri.file(queryPath),
    );
    expect(Object.keys(queryInfo.byLanguage)[0]).toEqual("javascript");
  });

  itWithCodeQL()(
    "should resolve printAST queries for supported languages",
    async () => {
      for (const lang of supportedLanguages) {
        if (lang === "go") {
          // The codeql-go submodule is not available in the integration tests.
          return;
        }

        console.log(`resolving printAST queries for ${lang}`);
        const pack = await getQlPackForDbscheme(cli, languageToDbScheme[lang]);
        expect(pack.dbschemePack).toContain(lang);
        if (pack.dbschemePackIsLibraryPack) {
          expect(pack.queryPack).toContain(lang);
        }

        const result = await resolveContextualQueries(
          cli,
          pack,
          KeyType.PrintAstQuery,
        );

        // It doesn't matter what the name or path of the query is, only
        // that we have found exactly one query.
        expect(result.length).toBe(1);
      }
    },
  );

  describe("github authentication", () => {
    itWithCodeQL()(
      "should not use authentication if there are no credentials",
      async () => {
        const getSession = jest
          .spyOn(authentication, "getSession")
          .mockResolvedValue(undefined);

        await cli.packDownload(["codeql/tutorial"]);
        expect(getSession).toHaveBeenCalledTimes(1);
        expect(getSession).toHaveBeenCalledWith(
          "github",
          expect.arrayContaining(["read:packages"]),
          {
            createIfNone: false,
          },
        );
      },
    );

    itWithCodeQL()(
      "should use authentication if there are credentials",
      async () => {
        const getSession = jest
          .spyOn(authentication, "getSession")
          .mockResolvedValue({
            id: faker.string.uuid(),
            accessToken: "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            account: {
              id: faker.string.uuid(),
              label: "Account",
            },
            scopes: ["read:packages"],
          });

        await cli.packDownload(["codeql/tutorial"]);
        expect(getSession).toHaveBeenCalledTimes(2);
        expect(getSession).toHaveBeenCalledWith(
          "github",
          expect.arrayContaining(["read:packages"]),
          {
            createIfNone: false,
          },
        );
        expect(getSession).toHaveBeenCalledWith(
          "github",
          expect.arrayContaining(["read:packages"]),
          {
            createIfNone: true,
          },
        );
      },
    );
  });
});
