import type { Log } from "sarif";
import { createReadStream } from "fs-extra";
import { Assembler } from "stream-json/assembler.js";
import { getErrorMessage } from "./helpers-pure";
import { ignore } from "stream-json/filters/ignore.js";

export async function sarifParser(
  interpretedResultsPath: string,
): Promise<Log> {
  try {
    // Parse the SARIF file into token streams, filtering out some of the larger subtrees that we
    // don't need.
    const pipeline = createReadStream(interpretedResultsPath).pipe(
      ignore.withParserAsStream({
        // We don't need to run's `artifacts` property, nor the driver's `notifications` property.
        filter: /^runs\.\d+\.(artifacts|tool\.driver\.notifications)/,
        // Allow the parser to keep reading past the first top-level JSON value instead of
        // throwing on any trailing data. We only care about the first value (resolved via
        // `onDone` below), so any trailing content is simply ignored.
        jsonStreaming: true,
      }),
    );

    // Returns a constructed Log object with the results of an empty array if no results were found.
    // If the parser fails for any reason, it will reject the promise.
    return await new Promise((resolve, reject) => {
      let alreadyDone = false;

      // Creates JavaScript objects from the token stream
      Assembler.connectTo<Log>(pipeline, {
        onDone: (asm) => {
          const log = asm.current;

          // Do some trivial validation. This isn't a full validation of the SARIF file, but it's at
          // least enough to ensure that we're not trying to parse complete garbage later.
          if (log === null || log.runs === undefined || log.runs.length < 1) {
            reject(
              new Error(
                "Invalid SARIF file: expecting at least one run with result.",
              ),
            );
            return;
          }

          resolve(log);
          alreadyDone = true;
        },
      });

      pipeline.on("error", (error: Error) => {
        reject(error);
      });

      // If the parser pipeline completes before the assembler, we've reached end of file and have not found any results.
      pipeline.on("end", () => {
        if (!alreadyDone) {
          reject(
            new Error(
              "Invalid SARIF file: expecting at least one run with result.",
            ),
          );
        }
      });
    });
  } catch (e) {
    throw new Error(
      `Parsing output of interpretation failed: ${getErrorMessage(e)}`,
    );
  }
}
