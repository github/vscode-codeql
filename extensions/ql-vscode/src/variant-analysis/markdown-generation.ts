import { tryGetRemoteLocation } from "../common/bqrs-utils";
import { createRemoteFileRef } from "../common/location-link-utils";
import {
  parseHighlightedLine,
  shouldHighlightLine,
} from "../common/sarif-utils";
import { convertNonPrintableChars } from "../common/text-utils";
import type {
  AnalysisAlert,
  AnalysisRawResults,
  CodeSnippet,
  FileLink,
  HighlightedRegion,
} from "./shared/analysis-result";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";
import type { RepositoryWithMetadata } from "./shared/repository";
import type { CellValue } from "../common/raw-result-types";

type MarkdownLinkType = "local" | "gist";

export interface MarkdownFile {
  fileName: string;
  content: string[]; // Each array item is a line of the markdown file.
}

export interface RepositorySummary {
  fileName: string;
  repository: RepositoryWithMetadata;
  resultCount: number;
}

interface VariantAnalysisMarkdown {
  markdownFiles: MarkdownFile[];
  summaries: RepositorySummary[];
}

/**
 * Generates markdown files with variant analysis results.
 */
export async function generateVariantAnalysisMarkdown(
  variantAnalysis: Pick<VariantAnalysis, "language" | "query">,
  results: AsyncIterable<
    [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
  >,
  expectedResultsCount: number,
  linkType: MarkdownLinkType,
): Promise<VariantAnalysisMarkdown> {
  const resultsFiles: MarkdownFile[] = [];
  const summaries: RepositorySummary[] = [];

  for await (const [scannedRepo, result] of results) {
    if (!scannedRepo.resultCount) {
      continue;
    }

    // Append nwo and results count to the summary table
    const fullName = scannedRepo.repository.fullName;
    const fileName = createVariantAnalysisFileName(
      fullName,
      resultsFiles.length,
      expectedResultsCount,
      linkType,
    );
    summaries.push({
      fileName,
      repository: scannedRepo.repository,
      resultCount: scannedRepo.resultCount,
    });

    // Generate individual markdown file for each repository
    const resultsFileContent = [`### ${scannedRepo.repository.fullName}`, ""];
    if (result.interpretedResults) {
      for (const interpretedResult of result.interpretedResults) {
        const individualResult = generateMarkdownForInterpretedResult(
          interpretedResult,
          variantAnalysis.language,
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

  // Generate summary file with links to individual files
  const summaryFile: MarkdownFile = generateVariantAnalysisMarkdownSummary(
    variantAnalysis.query,
    summaries,
    linkType,
  );

  return {
    markdownFiles: [summaryFile, ...resultsFiles],
    summaries,
  };
}

function generateVariantAnalysisMarkdownSummary(
  query: VariantAnalysis["query"],
  summaries: RepositorySummary[],
  linkType: MarkdownLinkType,
): MarkdownFile {
  const lines: string[] = [];
  // Title
  lines.push(`### Results for "${query.name}"`, "");

  // Expandable section containing query text
  const queryCodeBlock = ["```ql", ...query.text.split("\n"), "```", ""];
  lines.push(...buildExpandableMarkdownSection("Query", queryCodeBlock));

  // Padding between sections
  lines.push("<br />", "");

  // Summary table
  lines.push("### Summary", "", "| Repository | Results |", "| --- | --- |");

  for (const summary of summaries) {
    // Append nwo and results count to the summary table
    const fullName = summary.repository.fullName;
    const link = createRelativeLink(summary.fileName, linkType);
    lines.push(`| ${fullName} | [${summary.resultCount} result(s)](${link}) |`);
  }

  // Add a trailing newline
  lines.push("");

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
      interpretedResult.highlightedRegion,
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
        token.location.highlightedRegion,
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
        threadFlow.highlightedRegion,
      );
      pathLines.push(`${listNumber}. ${link}`);

      if (threadFlow.codeSnippet) {
        const codeSnippet = generateMarkdownForCodeSnippet(
          threadFlow.codeSnippet,
          language,
          threadFlow.highlightedRegion,
        );
        const indentation = " ".repeat(listNumber.toString().length + 2);
        pathLines.push(
          ...codeSnippet.map((line) => (indentation + line).trimEnd()),
        );
      }
    }
    lines.push(...buildExpandableMarkdownSection(title, pathLines));
  }
  return lines;
}

function generateMarkdownForRawResults(
  analysisRawResults: AnalysisRawResults,
): string[] {
  const tableRows: string[] = [];
  const columnCount = analysisRawResults.resultSet.columns.length;
  // Table headers are the column names if they exist, and empty otherwise
  const headers = analysisRawResults.resultSet.columns.map(
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
  switch (value.type) {
    case "string":
    case "number":
    case "boolean":
      cellValue = `\`${convertNonPrintableChars(value.value.toString())}\``;
      break;
    case "entity":
      {
        const url = tryGetRemoteLocation(
          value.value.url,
          fileLinkPrefix,
          sourceLocationPrefix,
        );
        if (url) {
          cellValue = `[\`${convertNonPrintableChars(
            value.value.label,
          )}\`](${url})`;
        } else {
          cellValue = `\`${convertNonPrintableChars(value.value.label)}\``;
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
function createMarkdownRemoteFileRef(
  fileLink: FileLink,
  region?: HighlightedRegion,
  linkText?: string,
): string {
  const markdownLink = `[${
    linkText || fileLink.filePath
  }](${createRemoteFileRef(
    fileLink,
    region?.startLine,
    region?.endLine,
    region?.startColumn,
    region?.endColumn,
  )})`;
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
 * Creates the name of the markdown file for a given repository nwo.
 * This name doesn't include the file extension.
 */
function createVariantAnalysisFileName(
  fullName: string,
  index: number,
  expectedResultsCount: number,
  linkType: MarkdownLinkType,
) {
  const baseName = createFileName(fullName);
  if (linkType === "gist") {
    const requiredNumberOfDecimals = Math.ceil(
      Math.log10(expectedResultsCount),
    );

    const prefix = (index + 1)
      .toString()
      .padStart(requiredNumberOfDecimals, "0");

    return `result-${prefix}-${baseName}`;
  }

  return baseName;
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
