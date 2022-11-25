import * as fs from "fs-extra";

/**
 * Read a file consisting of multiple JSON objects. Each object is separated from the previous one
 * by a double newline sequence. This is basically a more human-readable form of JSONL.
 *
 * The current implementation reads the entire text of the document into memory, but in the future
 * it will stream the document to improve the performance with large documents.
 *
 * @param path The path to the file.
 * @param handler Callback to be invoked for each top-level JSON object in order.
 */
export async function readJsonlFile(
  path: string,
  handler: (value: any) => Promise<void>,
): Promise<void> {
  const logSummary = await fs.readFile(path, "utf-8");

  // Remove newline delimiters because summary is in .jsonl format.
  const jsonSummaryObjects: string[] = logSummary.split(/\r?\n\r?\n/g);

  for (const obj of jsonSummaryObjects) {
    const jsonObj = JSON.parse(obj);
    await handler(jsonObj);
  }
}
