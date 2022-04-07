import { FileLink } from '../remote-queries/shared/analysis-result';

export function createRemoteFileRef(
  fileLink: FileLink,
  startLine?: number,
  endLine?: number
): string {
  if (startLine && endLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}-L${endLine}`;
  } else if (startLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}`;
  } else {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}`;
  }
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
