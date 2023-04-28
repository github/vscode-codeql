import * as Sarif from "sarif";
import { createReadStream } from "fs-extra";
import { connectTo } from "stream-json/Assembler";
import { getErrorMessage } from "../pure/helpers-pure";
import { withParser } from "stream-json/filters/Pick";

const DUMMY_TOOL: Sarif.Tool = { driver: { name: "" } };

export async function sarifParser(
  interpretedResultsPath: string,
): Promise<Sarif.Log> {
  try {
    // Parse the SARIF file into token streams, filtering out only the results array.
    const pipeline = createReadStream(interpretedResultsPath).pipe(
      withParser({ filter: "runs.0.results" }),
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
        const log: Sarif.Log = {
          version: "2.1.0",
          runs: [
            {
              tool: DUMMY_TOOL,
              results: asm.current ?? [],
            },
          ],
        };

        resolve(log);
        alreadyDone = true;
      });
    });
  } catch (e) {
    throw new Error(
      `Parsing output of interpretation failed: ${
        (e as any).stderr || getErrorMessage(e)
      }`,
    );
  }
}
