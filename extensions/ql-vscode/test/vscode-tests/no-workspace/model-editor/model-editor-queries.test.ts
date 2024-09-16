import { readFile, readFileSync, readdir } from "fs-extra";
import { join } from "path";
import { load } from "js-yaml";
import { setUpPack } from "../../../../src/model-editor/model-editor-queries-setup";
import { dirSync } from "tmp-promise";
import { fetchExternalApiQueries } from "../../../../src/model-editor/queries";
import type { QueryLanguage } from "../../../../src/common/query-language";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { createMockLogger } from "../../../__mocks__/loggerMock";

describe("setUpPack", () => {
  let queryDir: string;

  beforeEach(async () => {
    queryDir = dirSync({ unsafeCleanup: true }).name;
  });

  const languages = Object.keys(fetchExternalApiQueries).flatMap((lang) => {
    const query = fetchExternalApiQueries[lang as QueryLanguage];
    if (!query) {
      return [];
    }

    return { language: lang as QueryLanguage, query };
  });

  if (languages.length === 0) {
    // If we currently don't have any bundled queries, skip this test, but ensure there's still at least one test.
    test("should not have any bundled queries", () => {
      expect(languages).toHaveLength(0);
    });

    return;
  }

  describe.each(languages)("for language $language", ({ language, query }) => {
    test("should create the files when not found", async () => {
      const cliServer = mockedObject<CodeQLCliServer>({
        packDownload: jest.fn(),
        packInstall: jest.fn(),
        resolveQueriesInSuite: jest.fn().mockResolvedValue([]),
      });
      const logger = createMockLogger();

      await setUpPack(cliServer, logger, queryDir, language, Mode.Application);

      const queryFiles = await readdir(queryDir);
      expect(queryFiles).toEqual(
        expect.arrayContaining([
          "codeql-pack.yml",
          "ApplicationModeEndpoints.ql",
          "FrameworkModeEndpoints.ql",
        ]),
      );

      const suiteFileContents = await readFile(
        join(queryDir, "codeql-pack.yml"),
        "utf8",
      );
      const suiteYaml = load(suiteFileContents);
      expect(suiteYaml).toEqual({
        name: "codeql/model-editor-queries",
        version: "0.0.0",
        dependencies: {
          [`codeql/${language}-all`]: "*",
        },
      });

      Object.values(Mode).forEach((mode) => {
        expect(
          readFileSync(
            join(
              queryDir,
              `${mode.charAt(0).toUpperCase() + mode.slice(1)}ModeEndpoints.ql`,
            ),
            "utf8",
          ),
        ).toEqual(query[`${mode}ModeQuery`]);
      });

      for (const [filename, contents] of Object.entries(
        query.dependencies ?? {},
      )) {
        expect(await readFile(join(queryDir, filename), "utf8")).toEqual(
          contents,
        );
      }
    });

    test("should not create the files when found", async () => {
      const cliServer = mockedObject<CodeQLCliServer>({
        packDownload: jest.fn(),
        packInstall: jest.fn(),
        resolveQueriesInSuite: jest
          .fn()
          .mockResolvedValue(["/a/b/c/ApplicationModeEndpoints.ql"]),
      });
      const logger = createMockLogger();

      await setUpPack(cliServer, logger, queryDir, language, Mode.Application);

      const queryFiles = await readdir(queryDir);
      expect(queryFiles.sort()).toEqual(["codeql-pack.yml"].sort());

      const suiteFileContents = await readFile(
        join(queryDir, "codeql-pack.yml"),
        "utf8",
      );
      const suiteYaml = load(suiteFileContents);
      expect(suiteYaml).toEqual({
        name: "codeql/model-editor-queries",
        version: "0.0.0",
        dependencies: {},
      });
    });
  });
});
