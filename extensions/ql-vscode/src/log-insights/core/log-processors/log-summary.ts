import { existsSync } from "fs";
import { codeqlFollow, log, showFileSizeMB } from "../util";
/**
 * Generates a summary of the evaluator log file `evaluatorLogFile` and writes it to `summaryFile`.
 *
 * This is essentially just a wrapper around `codeql generate log-summary`.
 *
 * If `summaryFile` already exists, it is not overwritten.
 */
export async function process(
  codeqlPath: string,
  evaluatorLogFile: string,
  summaryFile: string,
  format: "predicates" | "overall" | "text",
): Promise<void> {
  if (existsSync(summaryFile)) {
    // warn, but reuse existing file
    log(`Reusing existing ${summaryFile}.`);
    return;
  }
  await codeqlFollow(codeqlPath, [
    "generate",
    "log-summary",
    "--format",
    format,
    "--minify-output",
    evaluatorLogFile,
    ...(format === "text" ? ["--end-summary"] : []),
    summaryFile,
  ]);
  showFileSizeMB(summaryFile);
}
