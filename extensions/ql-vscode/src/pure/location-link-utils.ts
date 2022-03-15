export function createRemoteFileRef(
  filePrefix: string,
  filePath: string,
  startLine?: number,
  endLine?: number
): string {
  if (startLine && endLine) {
    return `${filePrefix}/${filePath}#L${startLine}-L${endLine}`;
  } else {
    return `${filePrefix}/${filePath}`;
  }
}
