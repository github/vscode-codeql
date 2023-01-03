import { extensions, Uri } from "vscode";
import { join } from "path";
import { SemVer } from "semver";

import { CodeQLCliServer, QueryInfoByLanguage } from "../../../src/cli";
import { CodeQLExtensionInterface } from "../../../src/extension";
import { itWithCodeQL } from "../cli";
import {
  getOnDiskWorkspaceFolders,
  getQlPackForDbscheme,
  languageToDbScheme,
} from "../../../src/helpers";
import { resolveQueries } from "../../../src/contextual/queryResolver";
import { KeyType } from "../../../src/contextual/keyType";

jest.setTimeout(60_000);

/**
 * Perform proper integration tests by running the CLI
 */
describe("Use cli", () => {
  let cli: CodeQLCliServer;
  let supportedLanguages: string[];

  beforeEach(async () => {
    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    if ("cliServer" in extension) {
      cli = extension.cliServer;
      supportedLanguages = await cli.getSupportedLanguages();
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }
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
    expect(result).toEqual(["-J-Xmx4096M", "--off-heap-ram=4096"]);
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

        const result = await resolveQueries(cli, pack, KeyType.PrintAstQuery);

        // It doesn't matter what the name or path of the query is, only
        // that we have found exactly one query.
        expect(result.length).toBe(1);
      }
    },
  );
});
