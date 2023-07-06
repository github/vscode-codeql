import { FileLink } from "../variant-analysis/shared/analysis-result";

export function createRemoteFileRef(
  fileLink: FileLink,
  startLine?: number,
  endLine?: number,
): string {
  if (startLine && endLine && startLine !== endLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}-L${endLine}`;
  } else if (startLine) {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}#L${startLine}`;
  } else {
    return `${fileLink.fileLinkPrefix}/${fileLink.filePath}`;
  }
}
