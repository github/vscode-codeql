import { existsSync, createReadStream } from "fs";
import { parser } from "stream-json";
import { streamObject } from "stream-json/streamers/StreamObject";
import type { PipelineEvent, PredicateTiming } from "../types";
import {
  describePath,
  execToFile,
  getMillis,
  getQueryId,
  log,
  writeJson,
} from "../util";

/**
 * Gets the expensive predicates from an `overall` summary of an evaluator log file.
 *
 * The resulting file is a JSON-encoded value of type {@link ExpensivePredicates}.
 *
 * If `expensivePredicatesFile` already exists, it is not overwritten.
 */
export async function process(
  codeqlPath: string,
  summaryOverallFile: string,
  expensivePredicatesFile: string,
): Promise<void> {
  if (existsSync(expensivePredicatesFile)) {
    // warn, but reuse existing file
    log(`Reusing existing ${expensivePredicatesFile}.`);
    return;
  }
  writeJson(
    expensivePredicatesFile,
    await getExpensivePredicates(codeqlPath, summaryOverallFile),
  );
}

type TimingArray = [
  predicate: string,
  millis: number,
  maxIterationMillis?: [number, number],
];

/**
 * A map from a query id to a list of expensive predicates.
 *
 * Each entry in the list of expensive predicates includes three components:
 * - The predicate name
 * - The number of milliseconds it took to evaluate the predicate
 *
 * Furthermore, in case the predicate is a recursive predicate, the
 * `maxIterationMillis` component also records which iteration was the slowest
 * (in milliseconds).
 */
export type ExpensivePredicates = Record<string, TimingArray[]>;

/**
 * Returns a promise that computes the list of expensive predicates for each query
 * evaluated in the run that produced the structured log file `evaluatorSummaryFile`.
 */
async function getExpensivePredicates(
  codeqlPath: string,
  summaryOverallFilePath: string,
): Promise<ExpensivePredicates> {
  const reducedSummaryOverallFilePath = `${summaryOverallFilePath}.reduced.json`;
  log(`Processing ${describePath(summaryOverallFilePath)}...`);
  const filterKey = "mostExpensivePerQuery";
  if (existsSync(reducedSummaryOverallFilePath)) {
    log(
      `Reduced overall summary file already exists at ${describePath(reducedSummaryOverallFilePath)}, reusing it...`,
    );
  } else {
    log(
      `Reducing ${summaryOverallFilePath} to just the ${filterKey} property at ${reducedSummaryOverallFilePath} (this may take a few minutes)...`,
    );
    // this can in principle be done by the `stream-json` library using `.pick`, but it appears to have an internal leak that causes it to OOM after processing gigabytes of data
    await execToFile(
      "jq",
      ["-c", `.${filterKey}`, summaryOverallFilePath],
      reducedSummaryOverallFilePath,
    );
    log(
      `Reduced ${summaryOverallFilePath} to ${describePath(reducedSummaryOverallFilePath)}.`,
    );
  }

  // Map from query file to a list of pairs containing timing and a predicate name
  const queries = new Map<string, TimingArray[]>();

  const stream = createReadStream(reducedSummaryOverallFilePath)
    .pipe(parser())
    .pipe(streamObject());

  function toNestedArray(x: PredicateTiming): TimingArray {
    if (x.maxIterationMillis) {
      return [x.predicate, x.millis, x.maxIterationMillis];
    } else {
      return [x.predicate, x.millis];
    }
  }

  let i = 0;
  stream.on("data", (data: { key: string; value: PipelineEvent[] }) => {
    const queryId = getQueryId(codeqlPath, data.key);
    if (queries.has(queryId)) {
      throw new Error(`Duplicate query id: ${queryId}`);
    }
    log(
      `Processing ${filterKey} #${i++}: ${queryId}, with ${data.value.length} events...`,
    );
    const predicateTimings: PredicateTiming[] = [];
    data.value.forEach((event) => {
      const timing = getMillis(event);
      const predicateTiming: PredicateTiming = {
        predicate: event.predicateName,
        millis: timing.millis,
        ...(timing.maxIterationMillis && {
          maxIterationMillis: timing.maxIterationMillis,
        }),
      };
      predicateTimings.push(predicateTiming);
    });
    queries.set(queryId, predicateTimings.map(toNestedArray));
  });
  await new Promise(function (resolve, reject) {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  log(
    `Processed ${summaryOverallFilePath} to data for ${queries.size} queries.`,
  );
  return Object.fromEntries(queries);
}
