import { stat } from "fs/promises";
import { createReadStream } from "fs-extra";
import { createInterface } from "readline";

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
  logger?: { log: (message: string) => void },
): Promise<void> {
  function parseJsonFromCurrentLines() {
    try {
      return JSON.parse(currentLineSequence.join("\n")) as T;
    } catch (e) {
      void logger?.log(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `Error: Failed to parse at line ${lineCount} of ${path} as JSON: ${(e as any)?.message ?? "UNKNOWN REASON"}. Problematic line below:\n${JSON.stringify(currentLineSequence, null, 2)}`,
      );
      throw e;
    }
  }

  function logProgress() {
    void logger?.log(
      `Processed ${lineCount} lines with ${parseCounts} parses...`,
    );
  }

  void logger?.log(
    `Parsing ${path} (${(await stat(path)).size / 1024 / 1024} MB)...`,
  );
  const fileStream = createReadStream(path, "utf8");
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let parseCounts = 0;
  let currentLineSequence: string[] = [];
  for await (const line of rl) {
    if (line === "") {
      // as mentioned above: a double newline sequence indicates the end of the current JSON object, so we parse it and pass it to the handler
      await handler(parseJsonFromCurrentLines());
      parseCounts++;
      currentLineSequence = [];
    } else {
      currentLineSequence.push(line);
    }
    lineCount++;
    if (lineCount % 1000000 === 0) {
      logProgress();
    }
  }
  // in case the file is not newline-terminated, we need to handle the last JSON object
  if (currentLineSequence.length > 0) {
    await handler(parseJsonFromCurrentLines());
  }
  logProgress();
}

const doubleLineBreakRegexp = /\n\r?\n/;

export async function readJsonlFile2<T>(
  path: string,
  handler: (value: T) => Promise<void>,
  logger?: { log: (message: string) => void },
): Promise<void> {
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
      void logger?.log(`Finishing parsing ${path}`);
      resolve();
    });
    stream.on("error", reject);
  });
}
