export function readableBytesMb(numBytes: number): string {
  return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
}
