import { UnzipProgressCallback } from "../unzip";
import { ProgressCallback, readableBytesMb } from "./progress";

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
