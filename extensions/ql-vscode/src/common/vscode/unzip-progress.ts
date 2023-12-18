import { ProgressCallback as ZipProgressCallback } from "../unzip";
import { ProgressCallback, readableBytesMb } from "./progress";

export function reportUnzipProgress(
  messagePrefix: string,
  progress: ProgressCallback,
): ZipProgressCallback {
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
