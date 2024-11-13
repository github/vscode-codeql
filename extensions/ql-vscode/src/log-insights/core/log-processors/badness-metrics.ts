import { existsSync } from "fs";
// eslint-disable-next-line import/no-namespace
import * as I from "immutable";
import { getDependentPredicates } from "../pipeline-log-parsing";
import type {
  ComputeRecursive,
  ComputeSimple,
  InLayer,
  PipelineEvent,
  PipelineRun,
} from "../types";
import {
  LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE,
  addEvent,
  iterateSCC,
  log,
  makeKey,
  streamJsonl,
  warn,
  writeJson,
} from "../util";

/**
 * Computes the "badness metric" from an `predicates` summary of an evaluator log file.
 *
 * The resulting file is a JSON-encoded value of type {@link BadnessMetrics}.
 *
 * If `badnessMetricsFile` already exists, it is not overwritten.
 */
export async function process(
  codeqlPath: string,
  summaryPredicatesFile: string,
  badnessMetricsFile: string,
): Promise<void> {
  if (existsSync(badnessMetricsFile)) {
    log(`Reusing existing ${badnessMetricsFile}.`);
    return;
  }
  writeJson(
    badnessMetricsFile,
    await getBadnessMetric(codeqlPath, summaryPredicatesFile),
  );
}

/**
 * The base data for computing the subjective badness of a pipeline.
 */
export type BadnessMetrics = {
  maxTupleCountMap: Record<string, number>;
  resultSizeMap: Record<string, number>;
  maxDependentPredicateSizeMap: Record<string, number>;
};

/**
 * Context to be passed around while computing badness metrics.
 */
type GlobalContext = {
  predicateSizes: Map<string, number>;
  layerEvents: Map<string, Array<ComputeRecursive | InLayer>>;
  absentPredicateSizeLookups: Set<string>;
  undefinedPredicateSizeLookups: Set<string>;
};

function warnAboutMissingResultSize(event: object) {
  // pretty print events for debugging: show top-level keys and their values, reducing nested objects to size, and long strings to their 10 first and last characters
  const eventTypeDescription = JSON.stringify(
    Object.fromEntries(
      Object.entries(event).map(([k, v]) => [
        k,
        Array.isArray(v)
          ? `ARRAY(${v.length})`
          : v === null
            ? "null"
            : typeof v === "object"
              ? `OBJECT(${Object.keys(v).length})`
              : typeof v === "string" && v.length > 20
                ? `STRING(${v.slice(0, 10)}...${v.slice(-10)})`
                : v,
      ]),
    ),
  );
  warn(
    `resultSize was not defined on an event we expected it to be defined for. Defaulting to 0. The event type was: ${eventTypeDescription})`,
  );
}

// Like, `max`, but returns 0 if no meaningful maximum can be computed.
function safeMax(it: Iterable<number>) {
  const m = Math.max(...it);
  return Number.isFinite(m) ? m : 0;
}

async function getPredicateSizesAndLayerEvents(evaluatorSummaryFile: string) {
  const predicateSizes = new Map<string, number>();
  const layerEvents = new Map<string, Array<ComputeRecursive | InLayer>>();

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
        case "EXTENSIONAL":
        case "COMPUTED_EXTENSIONAL":
        case "COMPUTE_SIMPLE":
        case "CACHACA":
        case "CACHE_HIT": {
          let resultSize = event.resultSize;
          if (resultSize === undefined) {
            warnAboutMissingResultSize(event);
            resultSize = 0;
          }
          predicateSizes.set(event.raHash, resultSize);
          break;
        }
        case "SENTINEL_EMPTY": {
          predicateSizes.set(event.raHash, 0);
          break;
        }
        case "COMPUTE_RECURSIVE":
        case "IN_LAYER": {
          let resultSize = event.resultSize;
          if (resultSize === undefined) {
            warnAboutMissingResultSize(event);
            resultSize = 0;
          }
          predicateSizes.set(event.raHash, resultSize);
          addEvent(layerEvents, event);
          break;
        }
      }
    },
  );
  return { predicateSizes, layerEvents };
}

// Sum arrays a and b element-wise, and pad with 0s if the arrays are not the same length.
function pointwiseSum(a: Int32Array, b: Int32Array): Int32Array {
  function reportIfInconsistent(ai: number, bi: number) {
    if (ai === -1 && bi !== -1) {
      warn(
        `Operation was not evaluated in the firt pipeline, but it was evaluated in the accumulated pipeline (with tuple count ${bi}).`,
      );
    }
    if (ai !== -1 && bi === -1) {
      warn(
        `Operation was evaluated in the firt pipeline (with tuple count ${ai}), but it was not evaluated in the accumulated pipeline.`,
      );
    }
  }

  const length = Math.max(a.length, b.length);
  const result = new Int32Array(length);
  for (let i = 0; i < length; i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    // -1 is used to represent the absence of a tuple count for a line in the pretty-printed RA (e.g. an empty line), so we ignore those.
    if (i < a.length && i < b.length && (ai === -1 || bi === -1)) {
      result[i] = -1;
      reportIfInconsistent(ai, bi);
    } else {
      result[i] = ai + bi;
    }
  }
  return result;
}

// Compute the metric dependent predicate sizes and the result size for a predicate in an SCC.
function badnessInputsForLayer(
  event: ComputeRecursive,
  inLayerEvent: InLayer | ComputeRecursive,
  raReference: string,
  iteration: number,
  { predicateSizes, layerEvents, absentPredicateSizeLookups }: GlobalContext,
) {
  function curDeltaSizes(predicate: string, i: number) {
    const events = layerEvents.get(event.raHash);
    if (events === undefined) {
      throw new Error(
        `Could not find entry in layerEvents for ${event.raHash}`,
      );
    }
    // If an iteration isn't present in the map it means it was skipped because the optimizer
    // inferred that it was empty. So its size is 0.
    return (
      events.find((x) => x.predicateName === predicate)?.deltaSizes[i] || 0
    );
  }

  function prevDeltaSizes(predicate: string, i: number) {
    // If an iteration isn't present in the map it means it was skipped because the optimizer
    // inferred that it was empty. So its size is 0.
    return curDeltaSizes(predicate, i - 1);
  }

  const dependentPredicates = getDependentPredicates(
    inLayerEvent.ra[raReference],
  );
  let dependentPredicateSizes: I.Map<string, number>;
  // We treat the base case as a non-recursive pipeline. In that case, the dependent predicates are
  // the dependencies of the base case and the cur_deltas.
  if (raReference === "base") {
    dependentPredicateSizes = I.Map(
      dependentPredicates.map((pred): [string, number] => {
        // A base case cannot contain a `prev_delta`, but it can contain a `cur_delta`.
        let size = 0;
        if (pred.endsWith("#cur_delta")) {
          size = curDeltaSizes(pred.slice(0, -"#cur_delta".length), iteration);
        } else {
          const hash = event.dependencies[pred];
          if (!predicateSizes.has(hash)) {
            absentPredicateSizeLookups.add(hash);
          }
          size = predicateSizes.get(hash) || 0;
        }
        return [pred, size];
      }),
    );
  } else {
    // It's a non-base case in a recursive pipeline. In that case, the dependent predicates are
    // only the prev_deltas.
    dependentPredicateSizes = I.Map(
      dependentPredicates
        .flatMap((pred) => {
          // If it's actually a prev_delta
          if (pred.endsWith("#prev_delta")) {
            // Return the predicate without the #prev_delta suffix.
            return [pred.slice(0, -"#prev_delta".length)];
          } else {
            // Not a recursive delta. Skip it.
            return [];
          }
        })
        .map((prev): [string, number] => {
          const size = prevDeltaSizes(prev, iteration);
          return [prev, size];
        }),
    );
  }

  const deltaSize = inLayerEvent.deltaSizes[iteration];
  return { dependentPredicateSizes, deltaSize };
}

// Compute the metric input for all the events in a SCC that starts with main node `event`
function badnessInputsForRecursiveDelta(
  event: ComputeRecursive,
  globalContext: GlobalContext,
) {
  // A bucket contains the pointwise sum of the tuple counts, result sizes and dependent predicate sizes
  // For each (predicate, order) in an SCC, we will compute a bucket.
  type Bucket = {
    tupleCounts: Int32Array;
    resultSize: number;
    dependentPredicateSizes: I.Map<string, number>;
  };

  // nameToOrderToBucket : predicate name -> ordering (i.e., standard, order_500000, etc.) -> bucket
  const nameToOrderToBucket = new Map<string, Map<string, Bucket>>();

  // Iterate through the SCC and compute the metric inputs
  iterateSCC(
    globalContext.layerEvents,
    event,
    (inLayerEvent, run, iteration) => {
      const raReference = run.raReference;
      const predicateName = inLayerEvent.predicateName;
      if (!nameToOrderToBucket.has(predicateName)) {
        nameToOrderToBucket.set(predicateName, new Map());
      }
      const orderTobucket = nameToOrderToBucket.get(predicateName);
      if (orderTobucket === undefined) {
        throw new Error(
          `Could not entry in nameToOrderToBucket for predicate ${predicateName}`,
        );
      }
      if (!orderTobucket.has(raReference)) {
        orderTobucket.set(raReference, {
          tupleCounts: new Int32Array(0),
          resultSize: 0,
          dependentPredicateSizes: I.Map(),
        });
      }

      const { dependentPredicateSizes, deltaSize } = badnessInputsForLayer(
        event,
        inLayerEvent,
        raReference,
        iteration,
        globalContext,
      );

      const bucket = orderTobucket.get(raReference);
      if (bucket === undefined) {
        throw new Error(
          `Could not find entry in orderTobucket for predicate ${predicateName} and order ${raReference}`,
        );
      }
      // Pointwise sum the tuple counts
      const newTupleCounts = pointwiseSum(
        bucket.tupleCounts,
        new Int32Array(run.counts),
      );
      const resultSize = bucket.resultSize + deltaSize;
      // Pointwise sum the deltas.
      const newDependentPredicateSizes =
        bucket.dependentPredicateSizes.mergeWith(
          (oldSize, newSize) => oldSize + newSize,
          dependentPredicateSizes,
        );
      orderTobucket.set(raReference, {
        tupleCounts: newTupleCounts,
        resultSize,
        dependentPredicateSizes: newDependentPredicateSizes,
      });
    },
  );
  return nameToOrderToBucket;
}

function describeGlobalContext({
  predicateSizes,
  absentPredicateSizeLookups,
  undefinedPredicateSizeLookups,
}: GlobalContext) {
  // show some stats about the predicate size lookups
  log(`There were ${predicateSizes.size} predicates with a size.`);
  // does the order matter here?
  warn(
    `There were ${absentPredicateSizeLookups.size} predicate size lookups for absent predicates (defaulted to size 0).`,
  );
  if (undefinedPredicateSizeLookups.size > 0) {
    // should this this fail during insertion?
    warn(
      `There were ${undefinedPredicateSizeLookups.size} predicate size lookups with an undefined size (defaulted to size 0).`,
    );
  }
  if (
    absentPredicateSizeLookups.has(undefined as unknown as string) ||
    undefinedPredicateSizeLookups.has(undefined as unknown as string)
  ) {
    // should this this fail during lookup?
    warn(
      `There was at least one predicate size lookup with an undefined predicate hash!?`,
    );
  }
}

// Compute the maximum tuple count and maximum dependent predicate size for a non-recursive pipeline
function badnessInputsForNonRecursiveDelta(
  pipelineRun: PipelineRun,
  event: ComputeSimple,
  globalContext: GlobalContext,
): { maxTupleCount: number; maxDependentPredicateSize: number } {
  const dependentPredicateSizes = Object.values(event.dependencies).map(
    (hash) => {
      if (!globalContext.predicateSizes.has(hash)) {
        globalContext.absentPredicateSizeLookups.add(hash);
        return 0;
      }
      const size = globalContext.predicateSizes.get(hash);
      if (size === undefined) {
        globalContext.undefinedPredicateSizeLookups.add(hash);
        return 0;
      }
      return size;
    },
  );
  const maxDependentPredicateSize = safeMax(dependentPredicateSizes);
  return {
    maxTupleCount: safeMax(pipelineRun.counts),
    maxDependentPredicateSize,
  };
}

/**
 * Returns a promise that computes the three components used to calculate the
 * badness score for the pipelines evaluated in the structured log file
 * `evaluatorSummaryFile`.
 *
 * The components are:
 * - `maxTupleCountMap`: A map from a unique pipeline name to the largest
 * tuple count produced by the pipeline.
 * - `resultSizeMap`: A map from a unique pipeline name to the number of tuples
 * in the resulting relation.
 * - `maxDependentPredicateSizeMap`: A map from a unique pipeline name to the
 * largest dependent predicate of the pipeline.
 *
 * For a non-recursive pipeline, the set of dependent predicates are the
 * predicate itself plus all predicates that appear in the pipeline.
 *
 * For a recursive predicate the dependent predicates are the predicate itself
 * plus all the dependent deltas.
 *
 * The final badness score of a predicate `p` is then computed as:
 * ```
 * badness = m / (max(r, d))
 * ```
 * where `m = maxTupleCountMap(p)`, `r = resultSizeMap(p)`, and
 * `d = maxDependentPredicateSizeMap(p)`.
 */
async function getBadnessMetric(
  codeqlPath: string,
  evaluatorSummaryFile: string,
): Promise<BadnessMetrics> {
  const globalContext: GlobalContext = {
    ...(await getPredicateSizesAndLayerEvents(evaluatorSummaryFile)),
    absentPredicateSizeLookups: new Set(),
    undefinedPredicateSizeLookups: new Set(),
  };

  // Map a key of the form "query-with-demand : predicate name" to its badness input.
  const maxTupleCountMap = new Map<string, number>();
  const resultSizeMap = new Map<string, number>();
  const maxDependentPredicateSizeMap = new Map<string, number>();

  function addEntriesForKey(
    key: string,
    maxTupleCount: number,
    resultSize: number,
    maxDependentPredicateSize: number,
  ) {
    if (maxDependentPredicateSize > 0) {
      maxTupleCountMap.set(key, maxTupleCount);
      resultSizeMap.set(key, resultSize);
      maxDependentPredicateSizeMap.set(key, maxDependentPredicateSize);
      if (resultSizeMap.size % 1000 === 0) {
        log(
          `Registered ${resultSizeMap.size} badness metric entries so far...`,
        );
      }
    }
  }

  /**
   * Processes a ComputeSimple event, recording data in the state as appropriate.
   */
  function processComputeSimple(event: ComputeSimple): void {
    if (!event.pipelineRuns) {
      // skip if the optional pipelineRuns field is not present.
      return;
    }
    // Compute the badness metric for a non-recursive predicate. The metric in this case is defined as:
    // badness = (max tuple count in the pipeline) / (largest predicate this pipeline depends on)
    const key = makeKey(
      codeqlPath,
      event.queryCausingWork,
      event.predicateName,
      event.raHash,
    );
    // We have already reported a warning if resultSize is undefined. So we just default to 0 silently here.
    const resultSize = event.resultSize ?? 0;

    // There is only one entry in `pipelineRuns` if it's a non-recursive predicate.
    const { maxTupleCount, maxDependentPredicateSize } =
      badnessInputsForNonRecursiveDelta(
        event.pipelineRuns[0],
        event,
        globalContext,
      );

    addEntriesForKey(key, maxTupleCount, resultSize, maxDependentPredicateSize);
  }

  /**
   * Processes a ComputerRecursive event, recording data in the state as appropriate.
   */
  function processComputeRecursive(event: ComputeRecursive): void {
    // Compute the badness metric for a recursive predicate for each ordering.
    // See https://github.com/github/codeql-coreql-team/issues/1289#issuecomment-1007237055 for
    // the definition.
    const sccMetricInput = badnessInputsForRecursiveDelta(event, globalContext);
    // Loop through each predicate in the SCC
    sccMetricInput.forEach((buckets, predicate) => {
      // Loop through each ordering of the predicate
      buckets.forEach((bucket, raReference) => {
        // Format the key as demanding-query:name (ordering)
        const key = makeKey(
          codeqlPath,
          event.queryCausingWork,
          predicate,
          event.raHash,
          `(${raReference})`,
        );
        const maxTupleCount = Math.max(...bucket.tupleCounts);
        const resultSize = bucket.resultSize;
        const maxDependentPredicateSize = Math.max(
          ...bucket.dependentPredicateSizes.values(),
        );

        addEntriesForKey(
          key,
          maxTupleCount,
          resultSize,
          maxDependentPredicateSize,
        );
      });
    });
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
          processComputeSimple(event);
          break;
        case "COMPUTE_RECURSIVE":
          processComputeRecursive(event);
          break;
      }
    },
  );

  describeGlobalContext(globalContext);

  return {
    maxTupleCountMap: Object.fromEntries(maxTupleCountMap),
    resultSizeMap: Object.fromEntries(resultSizeMap),
    maxDependentPredicateSizeMap: Object.fromEntries(
      maxDependentPredicateSizeMap,
    ),
  };
}
