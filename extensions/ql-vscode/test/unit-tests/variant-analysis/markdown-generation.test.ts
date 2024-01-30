import { join, resolve } from "path";
import { readdir, readFile } from "fs-extra";

import type { MarkdownFile } from "../../../src/variant-analysis/markdown-generation";
import { generateVariantAnalysisMarkdown } from "../../../src/variant-analysis/markdown-generation";
import type {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "../../../src/variant-analysis/shared/variant-analysis";
import { QueryLanguage } from "../../../src/common/query-language";
import type {
  AnalysisAlert,
  AnalysisRawResults,
} from "../../../src/variant-analysis/shared/analysis-result";

import pathProblemAnalysesResults from "../data/markdown-generation/interpreted-results/path-problem/analyses-results.json";
import problemAnalysesResults from "../data/markdown-generation/interpreted-results/problem/analyses-results.json";
import rawResultsAnalysesResults from "../data/markdown-generation/raw-results/analyses-results.json";

const dataPath = resolve(__dirname, "../data/markdown-generation");

describe(generateVariantAnalysisMarkdown.name, () => {
  describe("for path-problem query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const actualFiles = await generateVariantAnalysisMarkdown(
        {
          language: QueryLanguage.Javascript,
          query: {
            name: "Shell command built from environment values",
            filePath:
              "c:\\git-repo\\vscode-codeql-starter\\ql\\javascript\\ql\\src\\Security\\CWE-078\\ShellCommandInjectionFromEnvironment.ql",
            text: '/**\n * @name Shell command built from environment values\n * @description Building a shell command string with values from the enclosing\n *              environment may cause subtle bugs or vulnerabilities.\n * @kind path-problem\n * @problem.severity warning\n * @security-severity 6.3\n * @precision high\n * @id js/shell-command-injection-from-environment\n * @tags correctness\n *       security\n *       external/cwe/cwe-078\n *       external/cwe/cwe-088\n */\n\nimport javascript\nimport DataFlow::PathGraph\nimport semmle.javascript.security.dataflow.ShellCommandInjectionFromEnvironmentQuery\n\nfrom\n  Configuration cfg, DataFlow::PathNode source, DataFlow::PathNode sink, DataFlow::Node highlight,\n  Source sourceNode\nwhere\n  sourceNode = source.getNode() and\n  cfg.hasFlowPath(source, sink) and\n  if cfg.isSinkWithHighlight(sink.getNode(), _)\n  then cfg.isSinkWithHighlight(sink.getNode(), highlight)\n  else highlight = sink.getNode()\nselect highlight, source, sink, "This shell command depends on an uncontrolled $@.", sourceNode,\n  sourceNode.getSourceType()\n',
          },
        },
        getResults(pathProblemAnalysesResults),
        pathProblemAnalysesResults.length,
        "gist",
      );

      await checkGeneratedMarkdown(
        actualFiles.markdownFiles,
        "interpreted-results/path-problem/expected",
      );
    });
  });

  describe("for problem query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const actualFiles = await generateVariantAnalysisMarkdown(
        {
          language: QueryLanguage.Javascript,
          query: {
            name: "Inefficient regular expression",
            filePath:
              "c:\\git-repo\\vscode-codeql-starter\\ql\\javascript\\ql\\src\\Performance\\ReDoS.ql",
            text: '/**\n * @name Inefficient regular expression\n * @description A regular expression that requires exponential time to match certain inputs\n *              can be a performance bottleneck, and may be vulnerable to denial-of-service\n *              attacks.\n * @kind problem\n * @problem.severity error\n * @security-severity 7.5\n * @precision high\n * @id js/redos\n * @tags security\n *       external/cwe/cwe-1333\n *       external/cwe/cwe-730\n *       external/cwe/cwe-400\n */\n\nimport javascript\nimport semmle.javascript.security.performance.ReDoSUtil\nimport semmle.javascript.security.performance.ExponentialBackTracking\n\nfrom RegExpTerm t, string pump, State s, string prefixMsg\nwhere hasReDoSResult(t, pump, s, prefixMsg)\nselect t,\n  "This part of the regular expression may cause exponential backtracking on strings " + prefixMsg +\n    "containing many repetitions of \'" + pump + "\'."\n',
          },
        },
        getResults(problemAnalysesResults),
        problemAnalysesResults.length,
        "gist",
      );

      await checkGeneratedMarkdown(
        actualFiles.markdownFiles,
        "interpreted-results/problem/expected",
      );
    });
  });

  describe("for non-alert query", () => {
    it("should generate markdown file for each repo with results", async () => {
      const actualFiles = await generateVariantAnalysisMarkdown(
        {
          language: QueryLanguage.Javascript,
          query: {
            name: "Contradictory guard nodes",
            filePath: "c:\\Users\\foo\\bar\\quick-query.ql",
            text: '/**\n * @name Contradictory guard nodes\n * \n * @description Snippet from "UselessComparisonTest.ql"\n */\n\nimport javascript\n\n/**\n * Holds if there are any contradictory guard nodes in `container`.\n *\n * We use this to restrict reachability analysis to a small set of containers.\n */\npredicate hasContradictoryGuardNodes(StmtContainer container) {\n  exists(ConditionGuardNode guard |\n    RangeAnalysis::isContradictoryGuardNode(guard) and\n    container = guard.getContainer()\n  )\n}\n\nfrom StmtContainer c\nwhere hasContradictoryGuardNodes(c)\nselect c, c.getNumLines()',
          },
        },
        getResults(rawResultsAnalysesResults),
        rawResultsAnalysesResults.length,
        "gist",
      );

      await checkGeneratedMarkdown(
        actualFiles.markdownFiles,
        "raw-results/expected",
      );
    });
  });
});

async function* getResults(
  items: typeof pathProblemAnalysesResults | typeof rawResultsAnalysesResults,
): AsyncIterable<
  [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
> {
  for (const item of items) {
    yield [
      {
        ...item,
        analysisStatus: item.analysisStatus as VariantAnalysisRepoStatus,
      },
      {
        repositoryId: item.repository.id,
        variantAnalysisId: 1,
        interpretedResults: item.interpretedResults as AnalysisAlert[],
        rawResults:
          "rawResults" in item
            ? (item.rawResults as AnalysisRawResults)
            : undefined,
      },
    ];
  }
}

/**
 * Reads a test output file and returns it as a string.
 * Replaces line endings with '\n' for consistency across operating systems.
 */
async function readTestOutputFile(relativePath: string): Promise<string> {
  const file = await readFile(join(dataPath, relativePath), "utf8");
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
  const expectedDir = join(dataPath, testDataBasePath);
  const expectedFiles = await readdir(expectedDir);

  expect(actualFiles.length).toBe(expectedFiles.length);

  const actualFileNames = actualFiles.map((file) => `${file.fileName}.md`);

  for (const expectedFile of expectedFiles) {
    expect(actualFileNames).toContain(expectedFile);
    const actualFile = actualFiles.find(
      (f) => `${f.fileName}.md` === expectedFile,
    );
    expect(actualFile).toBeDefined();
    const expectedContent = await readTestOutputFile(
      join(testDataBasePath, expectedFile),
    );
    expect(actualFile!.content.join("\n").trim()).toBe(expectedContent.trim());
  }
}
