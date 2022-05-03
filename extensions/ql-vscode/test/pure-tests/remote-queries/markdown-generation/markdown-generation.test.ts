import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { generateMarkdown } from '../../../../src/remote-queries/remote-queries-markdown-generation';

describe('markdown generation', async function() {
  describe('for path-problem query', async function() {
    it('should generate markdown file for each repo with results', async function() {
      const pathProblemQuery = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/interpreted-results/path-problem/path-problem-query.json'), 'utf8')
      );

      const analysesResults = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/interpreted-results/path-problem/analyses-results.json'), 'utf8')
      );
      const markdownFiles = generateMarkdown(pathProblemQuery, analysesResults, 'gist');

      // Check that query has results for two repositories, plus a summary file
      expect(markdownFiles.length).to.equal(3);

      const markdownFile0 = markdownFiles[0]; // summary file
      const markdownFile1 = markdownFiles[1]; // results for github/codeql repo
      const markdownFile2 = markdownFiles[2]; // results for meteor/meteor repo

      const expectedSummaryFile = await readTestOutputFile('data/interpreted-results/path-problem/summary.md');
      const expectedTestOutput1 = await readTestOutputFile('data/interpreted-results/path-problem/results-repo1.md');
      const expectedTestOutput2 = await readTestOutputFile('data/interpreted-results/path-problem/results-repo2.md');

      // Check that markdown output is correct, after making line endings consistent
      expect(markdownFile0.content.join('\n')).to.equal(expectedSummaryFile);
      expect(markdownFile1.content.join('\n')).to.equal(expectedTestOutput1);
      expect(markdownFile2.content.join('\n')).to.equal(expectedTestOutput2);
    });
  });

  describe('for problem query', async function() {
    it('should generate markdown file for each repo with results', async function() {
      const problemQuery = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/interpreted-results/problem/problem-query.json'), 'utf8')
      );

      const analysesResults = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/interpreted-results/problem/analyses-results.json'), 'utf8')
      );
      const markdownFiles = generateMarkdown(problemQuery, analysesResults, 'gist');

      // Check that query has results for two repositories, plus a summary file
      expect(markdownFiles.length).to.equal(3);

      const markdownFile0 = markdownFiles[0]; // summary file
      const markdownFile1 = markdownFiles[1]; // results for github/codeql repo
      const markdownFile2 = markdownFiles[2]; // results for meteor/meteor repo

      const expectedSummaryFile = await readTestOutputFile('data/interpreted-results/problem/summary.md');
      const expectedTestOutput1 = await readTestOutputFile('data/interpreted-results/problem/results-repo1.md');
      const expectedTestOutput2 = await readTestOutputFile('data/interpreted-results/problem/results-repo2.md');

      // Check that markdown output is correct, after making line endings consistent
      expect(markdownFile0.content.join('\n')).to.equal(expectedSummaryFile);
      expect(markdownFile1.content.join('\n')).to.equal(expectedTestOutput1);
      expect(markdownFile2.content.join('\n')).to.equal(expectedTestOutput2);
    });
  });

  describe('for non-alert query', async function() {
    it('should generate markdown file for each repo with results', async function() {
      const query = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/raw-results/query.json'), 'utf8')
      );
      const analysesResults = JSON.parse(
        await fs.readFile(path.join(__dirname, 'data/raw-results/analyses-results.json'), 'utf8')
      );

      const markdownFiles = generateMarkdown(query, analysesResults, 'gist');

      // Check that query has results for two repositories, plus a summary file
      expect(markdownFiles.length).to.equal(3);

      const markdownFile0 = markdownFiles[0]; // summary file
      const markdownFile1 = markdownFiles[1]; // results for github/codeql repo
      const markdownFile2 = markdownFiles[2]; // results for meteor/meteor repo

      const expectedSummaryFile = await readTestOutputFile('data/raw-results/summary.md');
      const expectedTestOutput1 = await readTestOutputFile('data/raw-results/results-repo1.md');
      const expectedTestOutput2 = await readTestOutputFile('data/raw-results/results-repo2.md');

      // Check that markdown output is correct, after making line endings consistent
      expect(markdownFile0.content.join('\n')).to.equal(expectedSummaryFile);
      expect(markdownFile1.content.join('\n')).to.equal(expectedTestOutput1);
      expect(markdownFile2.content.join('\n')).to.equal(expectedTestOutput2);
    });
  });
});

/**
 * Reads a test output file and returns it as a string.
 * Replaces line endings with '\n' for consistency across operating systems.
 */
async function readTestOutputFile(relativePath: string): Promise<string> {
  const file = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return file.replace(/\r?\n/g, '\n');
}
