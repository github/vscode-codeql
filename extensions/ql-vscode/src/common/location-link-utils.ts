import type { FileLink } from "../variant-analysis/shared/analysis-result";

export function createRemoteFileRef(
  fileLink: FileLink,
  startLine?: number,
  endLine?: number,
  startColumn?: number,
  endColumn?: number,
): string {
  if (
    startColumn &&
    endColumn &&
    startLine &&
    endLine &&
    // Verify that location information is valid; otherwise highlighting might be broken
    ((startLine === endLine && startColumn < endColumn) || startLine < endLine)
  ) {
    // This relies on column highlighting of new code view on GitHub
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}C${startColumn}-L${endLine}C${endColumn}`;
  } else if (startLine && endLine && startLine < endLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}-L${endLine}`;
  } else if (startLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}`;
  } else {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}`;
  }
}
