import type { Log } from "sarif";
import { createReadStream } from "fs-extra";
import { connectTo } from "stream-json/Assembler";
import { getErrorMessage } from "./helpers-pure";
import { withParser } from "stream-json/filters/Ignore";

export async function sarifParser(
  interpretedResultsPath: string,
): Promise<Log> {
  try {
    // Parse the SARIF file into token streams, filtering out some of the larger subtrees that we
    // don't need.
    const pipeline = createReadStream(interpretedResultsPath).pipe(
      withParser({
        // We don't need to run's `artifacts` property, nor the driver's `notifications` property.
        filter: /^runs\.\d+\.(artifacts|tool\.driver\.notifications)/,
      }),
    );

    // Creates JavaScript objects from the token stream
    const asm = connectTo(pipeline);

    // Returns a constructed Log object with the results of an empty array if no results were found.
    // If the parser fails for any reason, it will reject the promise.
    return await new Promise((resolve, reject) => {
      let alreadyDone = false;
      pipeline.on("error", (error) => {
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

      asm.on("done", (asm) => {
        const log = asm.current;

        // Do some trivial validation. This isn't a full validation of the SARIF file, but it's at
        // least enough to ensure that we're not trying to parse complete garbage later.
        if (log.runs === undefined || log.runs.length < 1) {
          reject(
            new Error(
              "Invalid SARIF file: expecting at least one run with result.",
            ),
          );
        }

        resolve(log);
        alreadyDone = true;
      });
    });
  } catch (e) {
    throw new Error(
      `Parsing output of interpretation failed: ${getErrorMessage(e)}`,
    );
  }
}
