import { readableBytesMb } from "../bytes";
import type { UnzipProgressCallback } from "../unzip";
import type { ProgressCallback } from "./progress";

export function reportUnzipProgress(
  messagePrefix: string,
  progress: ProgressCallback,
): UnzipProgressCallback {
  return ({ bytesExtracted, totalBytes }) => {
    progress({
      step: bytesExtracted,
      maxStep: totalBytes,
      message: `${messagePrefix} [${readableBytesMb(
        bytesExtracted,
      )} of ${readableBytesMb(totalBytes)}]`,
    });
  };
}
