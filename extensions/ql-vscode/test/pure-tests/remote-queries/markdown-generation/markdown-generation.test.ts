import { join } from "path";
import { readFile, readdir } from "fs-extra";
import {
  generateMarkdown,
  MarkdownFile,
} from "../../../../src/remote-queries/remote-queries-markdown-generation";

describe("markdown generation", () => {
  describe("for path-problem query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const pathProblemQuery = JSON.parse(
        await readFile(
          join(
            __dirname,
            "data/interpreted-results/path-problem/path-problem-query.json",
          ),
          "utf8",
        ),
      );

      const analysesResults = JSON.parse(
        await readFile(
          join(
            __dirname,
            "data/interpreted-results/path-problem/analyses-results.json",
          ),
          "utf8",
        ),
      );

      const actualFiles = generateMarkdown(
        pathProblemQuery,
        analysesResults,
        "gist",
      );

      await checkGeneratedMarkdown(
        actualFiles,
        "data/interpreted-results/path-problem/expected",
      );
    });
  });

  describe("for problem query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const problemQuery = JSON.parse(
        await readFile(
          join(
            __dirname,
            "data/interpreted-results/problem/problem-query.json",
          ),
          "utf8",
        ),
      );

      const analysesResults = JSON.parse(
        await readFile(
          join(
            __dirname,
            "data/interpreted-results/problem/analyses-results.json",
          ),
          "utf8",
        ),
      );
      const actualFiles = generateMarkdown(
        problemQuery,
        analysesResults,
        "gist",
      );

      await checkGeneratedMarkdown(
        actualFiles,
        "data/interpreted-results/problem/expected",
      );
    });
  });

  describe("for non-alert query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const query = JSON.parse(
        await readFile(join(__dirname, "data/raw-results/query.json"), "utf8"),
      );
      const analysesResults = JSON.parse(
        await readFile(
          join(__dirname, "data/raw-results/analyses-results.json"),
          "utf8",
        ),
      );

      const actualFiles = generateMarkdown(query, analysesResults, "gist");

      await checkGeneratedMarkdown(actualFiles, "data/raw-results/expected");
    });
  });
});

/**
 * Reads a test output file and returns it as a string.
 * Replaces line endings with '\n' for consistency across operating systems.
 */
async function readTestOutputFile(relativePath: string): Promise<string> {
  const file = await readFile(join(__dirname, relativePath), "utf8");
  return file.replace(/\r?\n/g, "\n");
}

/**
 * Compares the generated (actual) markdown files to the expected markdown files and
 * checks whether the names and contents are the same.
 */
async function checkGeneratedMarkdown(
  actualFiles: MarkdownFile[],
  testDataBasePath: string,
) {
  const expectedDir = join(__dirname, testDataBasePath);
  const expectedFiles = await readdir(expectedDir);

  expect(actualFiles.length).toBe(expectedFiles.length);

  for (const expectedFile of expectedFiles) {
    const actualFile = actualFiles.find(
      (f) => `${f.fileName}.md` === expectedFile,
    );
    expect(actualFile).toBeDefined();
    const expectedContent = await readTestOutputFile(
      join(testDataBasePath, expectedFile),
    );
    expect(actualFile!.content.join("\n")).toBe(expectedContent);
  }
}
