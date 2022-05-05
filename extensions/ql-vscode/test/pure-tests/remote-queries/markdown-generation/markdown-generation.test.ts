import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { generateMarkdown } from '../../../../src/remote-queries/remote-queries-markdown-generation';

const expectedFileNames = ['summary', 'github-codeql', 'meteor-meteor'];

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

      for (let i = 0; i < markdownFiles.length; i++) {
        const markdownFile = markdownFiles[i];
        const expectedContent = await readTestOutputFile(`data/interpreted-results/path-problem/expected/${expectedFileNames[i]}.md`);

        // Check that the markdown file has the expected name
        expect(markdownFile.fileName).to.equal(expectedFileNames[i]);
        // Check that the markdown file has the expected content
        expect(markdownFile.content.join('\n')).to.equal(expectedContent);
      }
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

      for (let i = 0; i < markdownFiles.length; i++) {
        const markdownFile = markdownFiles[i];
        const expectedContent = await readTestOutputFile(`data/interpreted-results/problem/expected/${expectedFileNames[i]}.md`);

        // Check that the markdown file has the expected name
        expect(markdownFile.fileName).to.equal(expectedFileNames[i]);
        // Check that the markdown file has the expected content
        expect(markdownFile.content.join('\n')).to.equal(expectedContent);
      }
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

      for (let i = 0; i < markdownFiles.length; i++) {
        const markdownFile = markdownFiles[i];
        const expectedContent = await readTestOutputFile(`data/raw-results/expected/${expectedFileNames[i]}.md`);

        // Check that the markdown file has the expected name
        expect(markdownFile.fileName).to.equal(expectedFileNames[i]);
        // Check that the markdown file has the expected content
        expect(markdownFile.content.join('\n')).to.equal(expectedContent);
      }
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
