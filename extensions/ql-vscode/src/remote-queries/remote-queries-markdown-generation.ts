import { createRemoteFileRef } from '../pure/location-link-utils';
import { parseHighlightedLine, shouldHighlightLine } from '../pure/sarif-utils';
import { RemoteQuery } from './remote-query';
import { AnalysisAlert, AnalysisResults, CodeSnippet, FileLink, HighlightedRegion } from './shared/analysis-result';

// Each array item is a line of the markdown file.
export type MarkdownFile = string[];

/**
 * Generates markdown files with variant analysis results.
 */
export function generateMarkdown(query: RemoteQuery, analysesResults: AnalysisResults[]): MarkdownFile[] {
  const files: MarkdownFile[] = [];
  // Generate summary file with links to individual files
  const summaryLines: MarkdownFile = generateMarkdownSummary(query);
  for (const analysisResult of analysesResults) {
    if (analysisResult.interpretedResults.length === 0) {
      // TODO: We'll add support for non-interpreted results later.
      continue;
    }

    // Append nwo and results count to the summary table
    const nwo = analysisResult.nwo;
    const resultsCount = analysisResult.interpretedResults.length;
    const link = createGistRelativeLink(nwo);
    summaryLines.push(`| ${nwo} | [${resultsCount} result(s)](${link}) |`);

    // Generate individual markdown file for each repository
    const lines = [
      `### ${analysisResult.nwo}`,
      ''
    ];
    for (const interpretedResult of analysisResult.interpretedResults) {
      const individualResult = generateMarkdownForInterpretedResult(interpretedResult, query.language);
      lines.push(...individualResult);
    }
    files.push(lines);
  }
  return [summaryLines, ...files];
}

export function generateMarkdownSummary(query: RemoteQuery): MarkdownFile {
  const lines: MarkdownFile = [];
  // Title
  lines.push(
    `### Results for "${query.queryName}"`,
    ''
  );

  // Expandable section containing query text
  const queryCodeBlock = [
    '```ql',
    ...query.queryText.split('\n'),
    '```',
  ];
  lines.push(
    ...buildExpandableMarkdownSection('Query', queryCodeBlock)
  );

  // Padding between sections
  lines.push(
    '<br />',
    '',
  );

  // Summary table
  lines.push(
    '### Summary',
    '',
    '| Repository | Results |',
    '| --- | --- |',
  );
  // nwo and result count will be appended to this table
  return lines;
}

function generateMarkdownForInterpretedResult(interpretedResult: AnalysisAlert, language: string): MarkdownFile {
  const lines: MarkdownFile = [];
  lines.push(createMarkdownRemoteFileRef(
    interpretedResult.fileLink,
    interpretedResult.highlightedRegion?.startLine,
    interpretedResult.highlightedRegion?.endLine
  ));
  lines.push('');
  const codeSnippet = interpretedResult.codeSnippet;
  const highlightedRegion = interpretedResult.highlightedRegion;
  if (codeSnippet) {
    lines.push(
      ...generateMarkdownForCodeSnippet(codeSnippet, language, highlightedRegion),
    );
  }
  const alertMessage = buildMarkdownAlertMessage(interpretedResult);
  lines.push(alertMessage);

  // Padding between results
  lines.push(
    '',
    '----------------------------------------',
    '',
  );
  return lines;
}

function generateMarkdownForCodeSnippet(
  codeSnippet: CodeSnippet,
  language: string,
  highlightedRegion?: HighlightedRegion
): MarkdownFile {
  const lines: MarkdownFile = [];
  const snippetStartLine = codeSnippet.startLine || 0;
  const codeLines = codeSnippet.text
    .split('\n')
    .map((line, index) =>
      highlightCodeLines(line, index + snippetStartLine, highlightedRegion)
    );
  lines.push(
    `<pre><code class="${language}">`,
    ...codeLines,
    '</code></pre>',
  );
  lines.push('');
  return lines;
}

function highlightCodeLines(
  line: string,
  lineNumber: number,
  highlightedRegion?: HighlightedRegion
): string {
  if (!highlightedRegion || !shouldHighlightLine(lineNumber, highlightedRegion)) {
    return line;
  }
  const partiallyHighlightedLine = parseHighlightedLine(
    line,
    lineNumber,
    highlightedRegion
  );
  return `${partiallyHighlightedLine.plainSection1}<strong>${partiallyHighlightedLine.highlightedSection}</strong>${partiallyHighlightedLine.plainSection2}`;
}

function buildMarkdownAlertMessage(interpretedResult: AnalysisAlert): string {
  let alertMessage = '';
  for (const token of interpretedResult.message.tokens) {
    if (token.t === 'text') {
      alertMessage += token.text;
    } else if (token.t === 'location') {
      alertMessage += createMarkdownRemoteFileRef(
        token.location.fileLink,
        token.location.highlightedRegion?.startLine,
        token.location.highlightedRegion?.endLine,
        token.text,
      );
    }
  }
  // Italicize the alert message
  return `*${alertMessage}*`;
}

/**
 * Creates a markdown link to a remote file.
 * If the "link text" is not provided, we use the file path.
 */
export function createMarkdownRemoteFileRef(
  fileLink: FileLink,
  startLine?: number,
  endLine?: number,
  linkText?: string,
): string {
  const markdownLink = `[${linkText || fileLink.filePath}](${createRemoteFileRef(fileLink, startLine, endLine)})`;
  return markdownLink;
}

/**
 * Builds an expandable markdown section of the form:
 * <details> 
 * <summary>title</summary>
 * 
 * contents
 * 
 * </details>
 */
function buildExpandableMarkdownSection(title: string, contents: MarkdownFile): MarkdownFile {
  const expandableLines: MarkdownFile = [];
  expandableLines.push(
    '<details>',
    `<summary>${title}</summary>`,
    '',
    ...contents,
    '',
    '</details>',
    ''
  );
  return expandableLines;
}

/**
 * Creates anchor link to a file in the gist. This is of the form:
 * '#file-<name>-<file-extension>'
 * 
 * TODO: Make sure these names align with the actual file names once we upload them to a gist.
 */
function createGistRelativeLink(nwo: string): string {
  const [owner, repo] = nwo.split('/');
  return `#file-${owner}-${repo}-md`;
}
