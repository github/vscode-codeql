import { existsSync } from "fs";
import { isUnion } from "../pipeline-log-parsing";
import type {
  ComputeRecursive,
  ComputeSimple,
  InLayer,
  PipelineEvent,
} from "../types";
import {
  addEvent,
  iterateSCC,
  log,
  LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE,
  makeKey,
  streamJsonl,
  writeJson,
} from "../util";

/**
 * Gets the tuple sums from an `predicates` summary of an evaluator log file.
 *
 * The resulting file is a JSON-encoded value of type {@link TupleSums}.
 *
 * If `tupleSumsFile` already exists, it is not overwritten.
 */
export async function process(
  codeqlPath: string,
  summaryPredicatesFile: string,
  tupleSumsFile: string,
): Promise<void> {
  if (existsSync(tupleSumsFile)) {
    // warn, but reuse existing file
    log(`Reusing existing ${tupleSumsFile}.`);
    return;
  }
  writeJson(
    tupleSumsFile,
    await getTupleSums(codeqlPath, summaryPredicatesFile),
  );
}

/**
 * A map from a predicate name to the sum of all the non-UNION tuple operations in the predicate's pipeline.
 */
export type TupleSums = Record<string, number>;

/**
 * Returns a promise that computes the tuple sums for all the predicates
 * evaluated in the structured log file `evaluatorSummaryFile`.
 */
async function getTupleSums(
  codeqlPath: string,
  evaluatorSummaryFile: string,
): Promise<TupleSums> {
  // Map a key (as defined by `makeKey`) to the sum of all the tuple counts of its pipeline.
  const predicateSum = new Map<string, number>();

  const layerEvents = new Map<string, Array<ComputeRecursive | InLayer>>();

  // Create the mapping from COMPUTE_RECURSIVE events to all of its IN_LAYER events.
  await streamJsonl(
    evaluatorSummaryFile,
    LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE,
    ({ value: event }: { value: PipelineEvent }) => {
      if (
        event.completionType !== undefined &&
        event.completionType !== "SUCCESS"
      ) {
        return; // Skip any evaluation that wasn't successful
      }
      switch (event.evaluationStrategy) {
        case "COMPUTE_RECURSIVE":
        case "IN_LAYER":
          addEvent(layerEvents, event);
      }
    },
  );

  // Sum all the tuple counts from from RA operations that aren't UNIONs.
  function sumTuples(ra: string[], counts: number[]) {
    const m = Math.min(counts.length, ra.length);

    let s = 0;
    for (let i = 0; i < m; ++i) {
      const c = counts[i];
      if (c > 0 && !isUnion(ra[i])) {
        s += c;
      }
    }
    return s;
  }

  function getSumForComputeSimple(event: ComputeSimple) {
    if (!event.pipelineRuns) {
      return undefined;
    }

    const raReference = event.pipelineRuns[0].raReference;
    const counts = event.pipelineRuns[0].counts;
    const ra = event.ra[raReference];
    const sum = sumTuples(ra, counts);
    const key = makeKey(
      codeqlPath,
      event.queryCausingWork,
      event.predicateName,
      event.raHash,
    );
    return { key, sum };
  }

  function getSumForComputeRecursive(event: ComputeRecursive) {
    // nameToOrderToBucket : predicate name -> ordering (i.e., standard, order_500000, etc.) -> sum
    const nameToOrderToSum = new Map<string, Map<string, number>>();

    // Iterate through the SCC and compute the metric inputs
    iterateSCC(layerEvents, event, (inLayerEvent, run, _iteration) => {
      const raReference = run.raReference;
      const predicateName = inLayerEvent.predicateName;
      if (!nameToOrderToSum.has(predicateName)) {
        nameToOrderToSum.set(predicateName, new Map());
      }
      const orderToSum = nameToOrderToSum.get(predicateName);
      if (orderToSum === undefined) {
        throw new Error(`Could not find orderToSum for ${predicateName}`);
      }
      if (!orderToSum.has(raReference)) {
        orderToSum.set(raReference, 0);
      }

      const orderSum = orderToSum.get(raReference);
      if (orderSum === undefined) {
        throw new Error(
          `Could not find entry for '${raReference}' in orderToSum`,
        );
      }
      const ra = inLayerEvent.ra[raReference];
      const tupleSum = sumTuples(ra, run.counts);
      const newSum = orderSum + tupleSum;

      orderToSum.set(raReference, newSum);
    });
    return nameToOrderToSum;
  }

  await streamJsonl(
    evaluatorSummaryFile,
    LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE,
    ({ value: event }: { value: PipelineEvent }) => {
      if (
        event.completionType !== undefined &&
        event.completionType !== "SUCCESS"
      ) {
        return;
      } // Skip any evaluation that wasn't successful
      switch (event.evaluationStrategy) {
        case "COMPUTE_SIMPLE":
          {
            const r = getSumForComputeSimple(event);
            if (r) {
              predicateSum.set(r.key, r.sum);
            }
          }
          break;
        case "COMPUTE_RECURSIVE":
          {
            const nameToOrderToSum = getSumForComputeRecursive(event);

            // Loop through each predicate in the SCC
            nameToOrderToSum.forEach((orderToSum, predicate) => {
              // Loop through each ordering of the predicate
              orderToSum.forEach((sum, raReference) => {
                // Format the key as demanding-query:name (ordering)
                const key = makeKey(
                  codeqlPath,
                  event.queryCausingWork,
                  predicate,
                  event.raHash,
                  `(${raReference})`,
                );

                predicateSum.set(key, sum);
              });
            });
          }
          break;
      }
    },
  );

  return Object.fromEntries(predicateSum);
}
