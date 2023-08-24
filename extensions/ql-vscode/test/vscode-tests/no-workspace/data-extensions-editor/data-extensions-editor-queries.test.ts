import { readFile, readFileSync, readdir } from "fs-extra";
import { join } from "path";
import { load } from "js-yaml";
import { setUpPack } from "../../../../src/data-extensions-editor/data-extensions-editor-queries";
import { dirSync } from "tmp-promise";
import { fetchExternalApiQueries } from "../../../../src/data-extensions-editor/queries";
import { QueryLanguage } from "../../../../src/common/query-language";
import { Mode } from "../../../../src/data-extensions-editor/shared/mode";

describe("setUpPack", () => {
  const languages = Object.keys(fetchExternalApiQueries).flatMap((lang) => {
    const queryDir = dirSync({ unsafeCleanup: true }).name;
    const query = fetchExternalApiQueries[lang as QueryLanguage];
    if (!query) {
      return [];
    }

    return { language: lang as QueryLanguage, queryDir, query };
  });

  test.each(languages)(
    "should create files for $language",
    async ({ language, queryDir, query }) => {
      await setUpPack(queryDir, language);

      const queryFiles = await readdir(queryDir);
      expect(queryFiles.sort()).toEqual(
        [
          "codeql-pack.yml",
          "FetchExternalApisApplicationMode.ql",
          "FetchExternalApisFrameworkMode.ql",
          "AutomodelVsCode.qll",
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
              `FetchExternalApis${
                mode.charAt(0).toUpperCase() + mode.slice(1)
              }Mode.ql`,
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
    },
  );
});
