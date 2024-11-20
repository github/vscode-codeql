import { stat } from "fs/promises";
import { createReadStream } from "fs-extra";

const doubleLineBreakRegexp = /\n\r?\n/;

/**
 * Read a file consisting of multiple JSON objects. Each object is separated from the previous one
 * by a double newline sequence. This is basically a more human-readable form of JSONL.
 *
 * @param path The path to the file.
 * @param handler Callback to be invoked for each top-level JSON object in order.
 */
export async function readJsonlFile<T>(
  path: string,
  handler: (value: T) => Promise<void>,
  logger?: BaseLogger,
): Promise<void> {
  // Stream the data as large evaluator logs won't fit in memory.
  // Also avoid using 'readline' as it is slower than our manual line splitting.
  void logger?.log(
    `Parsing ${path} (${(await stat(path)).size / 1024 / 1024} MB)...`,
  );
  return new Promise((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    let buffer = "";
    stream.on("data", async (chunk: string) => {
      const parts = (buffer + chunk).split(doubleLineBreakRegexp);
      buffer = parts.pop()!;
      if (parts.length > 0) {
        try {
          stream.pause();
          for (const part of parts) {
            await handler(JSON.parse(part));
          }
          stream.resume();
        } catch (e) {
          stream.destroy();
          reject(e);
        }
      }
    });
    stream.on("end", async () => {
      if (buffer.trim().length > 0) {
        try {
          await handler(JSON.parse(buffer));
        } catch (e) {
          reject(e);
          return;
        }
      }
      void logger?.log(`Finished parsing ${path}`);
      resolve();
    });
    stream.on("error", reject);
  });
}
