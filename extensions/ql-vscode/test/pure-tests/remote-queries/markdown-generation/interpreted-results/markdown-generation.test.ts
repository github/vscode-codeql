import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { generateMarkdown } from '../../../../../src/remote-queries/remote-queries-markdown-generation';

describe('markdown generation', async function() {
  it('should generate markdown file for each repo with results', async function() {
    const problemQuery = JSON.parse(
      await fs.readFile(path.join(__dirname, 'data/problem-query.json'), 'utf8')
    );

    const analysesResults = JSON.parse(
      await fs.readFile(path.join(__dirname, 'data/analyses-results.json'), 'utf8')
    );
    const markdownFiles = generateMarkdown(problemQuery, analysesResults);

    // Check that query has results for two repositories
    expect(markdownFiles.length).to.equal(2);

    const markdownFile1 = markdownFiles[0]; // results for github/codeql repo
    const markdownFile2 = markdownFiles[1]; // results for meteor/meteor repo

    const expectedTestOutput1 = await fs.readFile(path.join(__dirname, 'data/results-repo1.md'), 'utf8');
    const expectedTestOutput2 = await fs.readFile(path.join(__dirname, 'data/results-repo2.md'), 'utf8');

    // Check that markdown output is correct, after making line endings consistent
    expect(markdownFile1.join('\n')).to.equal(expectedTestOutput1.replace(/\r?\n/g, '\n'));
    expect(markdownFile2.join('\n')).to.equal(expectedTestOutput2.replace(/\r?\n/g, '\n'));
  });
});
