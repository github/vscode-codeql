import { createMarkdownRemoteFileRef } from '../pure/location-link-utils';
import { RemoteQuery } from './remote-query';
import { AnalysisAlert, AnalysisResults } from './shared/analysis-result';

// Each array item is a line of the markdown file.
export type MarkdownFile = string[];

export function generateMarkdown(query: RemoteQuery, analysesResults: AnalysisResults[]): MarkdownFile[] {
  const files: MarkdownFile[] = [];
  for (const analysisResult of analysesResults) {
    if (analysisResult.interpretedResults.length === 0) {
      continue;
    }
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
  return files;

}

function generateMarkdownForInterpretedResult(interpretedResult: AnalysisAlert, language: string): MarkdownFile {
  const lines: MarkdownFile = [];
  lines.push(createMarkdownRemoteFileRef(
    interpretedResult.fileLink,
    interpretedResult.highlightedRegion?.startLine,
    interpretedResult.highlightedRegion?.endLine
  ), '');
  const codeSnippet = interpretedResult.codeSnippet?.text;
  if (codeSnippet) {
    lines.push(
      `\`\`\`${language}`,
      ...codeSnippet.split('\n'),
      '```',
      ''
    );
  }
  const alertMessage = buildAlertMessage(interpretedResult);
  lines.push(alertMessage);

  // Padding between results
  lines.push(
    '',
    '----------------------------------------',
    '',
  );
  return lines;
}

function buildAlertMessage(interpretedResult: AnalysisAlert): string {
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
  return alertMessage;
}
