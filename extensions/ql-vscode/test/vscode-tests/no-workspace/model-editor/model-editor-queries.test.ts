import { readFile, readFileSync, readdir } from "fs-extra";
import { join } from "path";
import { load } from "js-yaml";
import { setUpPack } from "../../../../src/model-editor/model-editor-queries-setup";
import { dirSync } from "tmp-promise";
import { fetchExternalApiQueries } from "../../../../src/model-editor/queries";
import { QueryLanguage } from "../../../../src/common/query-language";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { mockedObject } from "../../utils/mocking.helpers";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { ModelConfig } from "../../../../src/config";

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

  describe.each(languages)("for language $language", ({ language, query }) => {
    test("should create the files when not found", async () => {
      const cliServer = mockedObject<CodeQLCliServer>({
        packDownload: jest.fn(),
        packInstall: jest.fn(),
        resolveQueriesInSuite: jest.fn().mockResolvedValue([]),
      });
      const modelConfig = mockedObject<ModelConfig>({
        llmGeneration: false,
      });

      await setUpPack(cliServer, queryDir, language, modelConfig);

      const queryFiles = await readdir(queryDir);
      expect(queryFiles.sort()).toEqual(
        [
          "codeql-pack.yml",
          "ApplicationModeEndpoints.ql",
          "ApplicationModeEndpointsQuery.qll",
          "FrameworkModeEndpoints.ql",
          "FrameworkModeEndpointsQuery.qll",
          "ModelEditor.qll",
        ].sort(),
      );

      const suiteFileContents = await readFile(
        join(queryDir, "codeql-pack.yml"),
        "utf8",
      );
      const suiteYaml = load(suiteFileContents);
      expect(suiteYaml).toEqual({
        name: "codeql/external-api-usage",
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
      const modelConfig = mockedObject<ModelConfig>({
        llmGeneration: false,
      });

      await setUpPack(cliServer, queryDir, language, modelConfig);

      const queryFiles = await readdir(queryDir);
      expect(queryFiles.sort()).toEqual(["codeql-pack.yml"].sort());

      const suiteFileContents = await readFile(
        join(queryDir, "codeql-pack.yml"),
        "utf8",
      );
      const suiteYaml = load(suiteFileContents);
      expect(suiteYaml).toEqual({
        name: "codeql/external-api-usage",
        version: "0.0.0",
        dependencies: {},
      });
    });
  });
});
