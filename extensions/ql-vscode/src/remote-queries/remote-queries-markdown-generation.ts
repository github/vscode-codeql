import { CellValue } from "../pure/bqrs-cli-types";
import { tryGetRemoteLocation } from "../pure/bqrs-utils";
import { createRemoteFileRef } from "../pure/location-link-utils";
import { parseHighlightedLine, shouldHighlightLine } from "../pure/sarif-utils";
import { convertNonPrintableChars } from "../text-utils";
import { RemoteQuery } from "./remote-query";
import {
  AnalysisAlert,
  AnalysisRawResults,
  AnalysisResults,
  CodeSnippet,
  FileLink,
  getAnalysisResultCount,
  HighlightedRegion,
} from "./shared/analysis-result";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";

export type MarkdownLinkType = "local" | "gist";

export interface MarkdownFile {
  fileName: string;
  content: string[]; // Each array item is a line of the markdown file.
}

/**
 * Generates markdown files with variant analysis results.
 */
export function generateMarkdown(
  query: RemoteQuery,
  analysesResults: AnalysisResults[],
  linkType: MarkdownLinkType,
): MarkdownFile[] {
  const resultsFiles: MarkdownFile[] = [];
  // Generate summary file with links to individual files
  const summaryFile: MarkdownFile = generateMarkdownSummary(query);
  for (const analysisResult of analysesResults) {
    const resultsCount = getAnalysisResultCount(analysisResult);
    if (resultsCount === 0) {
      continue;
    }

    // Append nwo and results count to the summary table
    const nwo = analysisResult.nwo;
    const fileName = createFileName(nwo);
    const link = createRelativeLink(fileName, linkType);
    summaryFile.content.push(
      `| ${nwo} | [${resultsCount} result(s)](${link}) |`,
    );

    // Generate individual markdown file for each repository
    const resultsFileContent = [`### ${analysisResult.nwo}`, ""];
    for (const interpretedResult of analysisResult.interpretedResults) {
      const individualResult = generateMarkdownForInterpretedResult(
        interpretedResult,
        query.language,
      );
      resultsFileContent.push(...individualResult);
    }
    if (analysisResult.rawResults) {
      const rawResultTable = generateMarkdownForRawResults(
        analysisResult.rawResults,
      );
      resultsFileContent.push(...rawResultTable);
    }
    resultsFiles.push({
      fileName,
      content: resultsFileContent,
    });
  }
  return [summaryFile, ...resultsFiles];
}

/**
 * Generates markdown files with variant analysis results.
 */
export async function generateVariantAnalysisMarkdown(
  variantAnalysis: VariantAnalysis,
  results: AsyncIterable<
    [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
  >,
  linkType: MarkdownLinkType,
): Promise<MarkdownFile[]> {
  const resultsFiles: MarkdownFile[] = [];
  // Generate summary file with links to individual files
  const summaryFile: MarkdownFile =
    generateVariantAnalysisMarkdownSummary(variantAnalysis);
  for await (const [scannedRepo, result] of results) {
    if (scannedRepo.resultCount === 0) {
      continue;
    }

    // Append nwo and results count to the summary table
    const fullName = scannedRepo.repository.fullName;
    const fileName = createFileName(fullName);
    const link = createRelativeLink(fileName, linkType);
    summaryFile.content.push(
      `| ${fullName} | [${scannedRepo.resultCount} result(s)](${link}) |`,
    );

    // Generate individual markdown file for each repository
    const resultsFileContent = [`### ${scannedRepo.repository.fullName}`, ""];
    if (result.interpretedResults) {
      for (const interpretedResult of result.interpretedResults) {
        const individualResult = generateMarkdownForInterpretedResult(
          interpretedResult,
          variantAnalysis.query.language,
        );
        resultsFileContent.push(...individualResult);
      }
    }
    if (result.rawResults) {
      const rawResultTable = generateMarkdownForRawResults(result.rawResults);
      resultsFileContent.push(...rawResultTable);
    }
    resultsFiles.push({
      fileName,
      content: resultsFileContent,
    });
  }
  return [summaryFile, ...resultsFiles];
}

export function generateMarkdownSummary(query: RemoteQuery): MarkdownFile {
  const lines: string[] = [];
  // Title
  lines.push(`### Results for "${query.queryName}"`, "");

  // Expandable section containing query text
  const queryCodeBlock = ["```ql", ...query.queryText.split("\n"), "```"];
  lines.push(...buildExpandableMarkdownSection("Query", queryCodeBlock));

  // Padding between sections
  lines.push("<br />", "");

  // Summary table
  lines.push("### Summary", "", "| Repository | Results |", "| --- | --- |");
  // nwo and result count will be appended to this table
  return {
    fileName: "_summary",
    content: lines,
  };
}

export function generateVariantAnalysisMarkdownSummary(
  variantAnalysis: VariantAnalysis,
): MarkdownFile {
  const lines: string[] = [];
  // Title
  lines.push(`### Results for "${variantAnalysis.query.name}"`, "");

  // Expandable section containing query text
  const queryCodeBlock = [
    "```ql",
    ...variantAnalysis.query.text.split("\n"),
    "```",
  ];
  lines.push(...buildExpandableMarkdownSection("Query", queryCodeBlock));

  // Padding between sections
  lines.push("<br />", "");

  // Summary table
  lines.push("### Summary", "", "| Repository | Results |", "| --- | --- |");
  // nwo and result count will be appended to this table
  return {
    fileName: "_summary",
    content: lines,
  };
}

function generateMarkdownForInterpretedResult(
  interpretedResult: AnalysisAlert,
  language: string,
): string[] {
  const lines: string[] = [];
  lines.push(
    createMarkdownRemoteFileRef(
      interpretedResult.fileLink,
      interpretedResult.highlightedRegion?.startLine,
      interpretedResult.highlightedRegion?.endLine,
    ),
  );
  lines.push("");
  const codeSnippet = interpretedResult.codeSnippet;
  const highlightedRegion = interpretedResult.highlightedRegion;
  if (codeSnippet) {
    lines.push(
      ...generateMarkdownForCodeSnippet(
        codeSnippet,
        language,
        highlightedRegion,
      ),
    );
  }
  const alertMessage = generateMarkdownForAlertMessage(interpretedResult);
  lines.push(alertMessage, "");

  // If available, show paths
  const hasPathResults = interpretedResult.codeFlows.length > 0;
  if (hasPathResults) {
    const pathLines = generateMarkdownForPathResults(
      interpretedResult,
      language,
    );
    lines.push(...pathLines);
  }

  // Padding between results
  lines.push("----------------------------------------", "");
  return lines;
}

function generateMarkdownForCodeSnippet(
  codeSnippet: CodeSnippet,
  language: string,
  highlightedRegion?: HighlightedRegion,
): string[] {
  const lines: string[] = [];
  const snippetStartLine = codeSnippet.startLine || 0;
  const codeLines = codeSnippet.text
    .split("\n")
    .map((line, index) =>
      highlightAndEscapeCodeLines(
        line,
        index + snippetStartLine,
        highlightedRegion,
      ),
    );

  // Make sure there are no extra newlines before or after the <code> block:
  const codeLinesWrapped = [...codeLines];
  codeLinesWrapped[0] = `<pre><code class="${language}">${codeLinesWrapped[0]}`;
  codeLinesWrapped[codeLinesWrapped.length - 1] = `${
    codeLinesWrapped[codeLinesWrapped.length - 1]
  }</code></pre>`;

  lines.push(...codeLinesWrapped, "");
  return lines;
}

function highlightAndEscapeCodeLines(
  line: string,
  lineNumber: number,
  highlightedRegion?: HighlightedRegion,
): string {
  if (
    !highlightedRegion ||
    !shouldHighlightLine(lineNumber, highlightedRegion)
  ) {
    return escapeHtmlCharacters(line);
  }
  const partiallyHighlightedLine = parseHighlightedLine(
    line,
    lineNumber,
    highlightedRegion,
  );

  const plainSection1 = escapeHtmlCharacters(
    partiallyHighlightedLine.plainSection1,
  );
  const highlightedSection = escapeHtmlCharacters(
    partiallyHighlightedLine.highlightedSection,
  );
  const plainSection2 = escapeHtmlCharacters(
    partiallyHighlightedLine.plainSection2,
  );

  return `${plainSection1}<strong>${highlightedSection}</strong>${plainSection2}`;
}

function generateMarkdownForAlertMessage(
  interpretedResult: AnalysisAlert,
): string {
  let alertMessage = "";
  for (const token of interpretedResult.message.tokens) {
    if (token.t === "text") {
      alertMessage += token.text;
    } else if (token.t === "location") {
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

function generateMarkdownForPathResults(
  interpretedResult: AnalysisAlert,
  language: string,
): string[] {
  const lines: string[] = [];
  lines.push("#### Paths", "");
  for (const codeFlow of interpretedResult.codeFlows) {
    const pathLines: string[] = [];
    const stepCount = codeFlow.threadFlows.length;
    const title = `Path with ${stepCount} steps`;
    for (let i = 0; i < stepCount; i++) {
      const listNumber = i + 1;
      const threadFlow = codeFlow.threadFlows[i];
      const link = createMarkdownRemoteFileRef(
        threadFlow.fileLink,
        threadFlow.highlightedRegion?.startLine,
        threadFlow.highlightedRegion?.endLine,
      );
      const codeSnippet = generateMarkdownForCodeSnippet(
        threadFlow.codeSnippet,
        language,
        threadFlow.highlightedRegion,
      );
      // Indent the snippet to fit with the numbered list.
      // The indentation is "n + 2" where the list number is an n-digit number.
      const codeSnippetIndented = codeSnippet.map(
        (line) => " ".repeat(listNumber.toString().length + 2) + line,
      );
      pathLines.push(`${listNumber}. ${link}`, ...codeSnippetIndented);
    }
    lines.push(...buildExpandableMarkdownSection(title, pathLines));
  }
  return lines;
}

function generateMarkdownForRawResults(
  analysisRawResults: AnalysisRawResults,
): string[] {
  const tableRows: string[] = [];
  const columnCount = analysisRawResults.schema.columns.length;
  // Table headers are the column names if they exist, and empty otherwise
  const headers = analysisRawResults.schema.columns.map(
    (column) => column.name || "",
  );
  const tableHeader = `| ${headers.join(" | ")} |`;

  tableRows.push(tableHeader);
  tableRows.push(`|${" --- |".repeat(columnCount)}`);

  for (const row of analysisRawResults.resultSet.rows) {
    const cells = row.map((cell) =>
      generateMarkdownForRawTableCell(
        cell,
        analysisRawResults.fileLinkPrefix,
        analysisRawResults.sourceLocationPrefix,
      ),
    );
    tableRows.push(`| ${cells.join(" | ")} |`);
  }
  return tableRows;
}

function generateMarkdownForRawTableCell(
  value: CellValue,
  fileLinkPrefix: string,
  sourceLocationPrefix: string,
) {
  let cellValue: string;
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      cellValue = `\`${convertNonPrintableChars(value.toString())}\``;
      break;
    case "object":
      {
        const url = tryGetRemoteLocation(
          value.url,
          fileLinkPrefix,
          sourceLocationPrefix,
        );
        if (url) {
          cellValue = `[\`${convertNonPrintableChars(value.label)}\`](${url})`;
        } else {
          cellValue = `\`${convertNonPrintableChars(value.label)}\``;
        }
      }
      break;
  }
  // `|` characters break the table, so we need to escape them
  return cellValue.replaceAll("|", "\\|");
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
  const markdownLink = `[${
    linkText || fileLink.filePath
  }](${createRemoteFileRef(fileLink, startLine, endLine)})`;
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
function buildExpandableMarkdownSection(
  title: string,
  contents: string[],
): string[] {
  const expandableLines: string[] = [];
  expandableLines.push(
    "<details>",
    `<summary>${title}</summary>`,
    "",
    ...contents,
    "",
    "</details>",
    "",
  );
  return expandableLines;
}

function createRelativeLink(
  fileName: string,
  linkType: MarkdownLinkType,
): string {
  switch (linkType) {
    case "local":
      return `./${fileName}.md`;

    case "gist":
      // Creates an anchor link to a file in the gist. This is of the form:
      // '#file-<name>-<file-extension>'
      return `#file-${fileName}-md`;
  }
}

/**
 * Creates the name of the markdown file for a given repository nwo.
 * This name doesn't include the file extension.
 */
function createFileName(nwo: string) {
  const [owner, repo] = nwo.split("/");
  return `${owner}-${repo}`;
}

/**
 * Escape characters that could be interpreted as HTML instead of raw code.
 */
function escapeHtmlCharacters(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
