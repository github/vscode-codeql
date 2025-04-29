import { readJsonlFile } from "../common/jsonl-reader";
import type { EvaluationLogProblemReporter } from "./log-scanner";
import type {
  InLayer,
  ComputeRecursive,
  SummaryEvent,
  PipelineRun,
  ComputeSimple,
} from "./log-summary";

/**
 * Like `max`, but returns 0 if no meaningful maximum can be computed.
 */
function safeMax(it?: Iterable<number>) {
  const m = Math.max(...(it || []));
  return Number.isFinite(m) ? m : 0;
}

function getDependentPredicates(operations: string[]): string[] {
  const id = String.raw`[0-9a-zA-Z:#_\./]+`;
  const idWithAngleBrackets = String.raw`[0-9a-zA-Z:#_<>\./]+`;
  const quotedId = String.raw`\`[^\`\r\n]*\``;
  const regexps = [
    // SCAN id
    String.raw`SCAN\s+(${id}|${quotedId})\s`,
    // JOIN id WITH id
    String.raw`JOIN\s+(${id}|${quotedId})\s+WITH\s+(${id}|${quotedId})\s`,
    // JOIN WITH id
    String.raw`JOIN\s+WITH\s+(${id}|${quotedId})\s`,
    // AGGREGATE id, id
    String.raw`AGGREGATE\s+(${id}|${quotedId})\s*,\s+(${id}|${quotedId})`,
    // id AND NOT id
    String.raw`(${id}|${quotedId})\s+AND\s+NOT\s+(${id}|${quotedId})`,
    // AND NOT id
    String.raw`AND\s+NOT\s+(${id}|${quotedId})`,
    // INVOKE HIGHER-ORDER RELATION rel ON <id, ..., id>
    String.raw`INVOKE\s+HIGHER-ORDER\s+RELATION\s[^\s]+\sON\s+<(${idWithAngleBrackets}|${quotedId})((?:,${idWithAngleBrackets}|,${quotedId})*)>`,
    // SELECT id
    String.raw`SELECT\s+(${id}|${quotedId})`,
    // REWRITE id WITH
    String.raw`REWRITE\s+(${id}|${quotedId})\s+WITH\s`,
    // id UNION id UNION ... UNION id
    String.raw`(${id}|${quotedId})((?:\s+UNION\s+${id}|${quotedId})+)`,
  ];
  const r = new RegExp(
    `${
      String.raw`\{[0-9]+\}\s+(?:[0-9a-zA-Z]+\s=|\|)\s(?:` + regexps.join("|")
    })`,
  );
  return operations.flatMap((operation) => {
    const matches = r.exec(operation.trim()) || [];
    return matches
      .slice(1) // Skip the first group as it's just the entire string
      .filter((x) => !!x)
      .flatMap((x) => x.split(",")) // Group 2 in the INVOKE HIGHER_ORDER RELATION case is a comma-separated list of identifiers.
      .flatMap((x) => x.split(" UNION ")) // Split n-ary unions into individual arguments.
      .filter((x) => !x.match("r[0-9]+|PRIMITIVE")) // Only keep the references to predicates.
      .filter((x) => !!x) // Remove empty strings
      .map((x) =>
        x.startsWith("`") && x.endsWith("`") ? x.substring(1, x.length - 1) : x,
      ); // Remove quotes from quoted identifiers
  });
}

function getMainHash(event: InLayer | ComputeRecursive): string {
  switch (event.evaluationStrategy) {
    case "IN_LAYER":
      return event.mainHash;
    case "COMPUTE_RECURSIVE":
      return event.raHash;
  }
}

/**
 * Sum arrays a and b element-wise. The shorter array is padded with 0s if the arrays are not the same length.
 */
function pointwiseSum(
  a: Int32Array,
  b: Int32Array,
  problemReporter: EvaluationLogProblemReporter,
): Int32Array {
  function reportIfInconsistent(ai: number, bi: number) {
    if (ai === -1 && bi !== -1) {
      problemReporter.log(
        `Operation was not evaluated in the first pipeline, but it was evaluated in the accumulated pipeline (with tuple count ${bi}).`,
      );
    }
    if (ai !== -1 && bi === -1) {
      problemReporter.log(
        `Operation was evaluated in the first pipeline (with tuple count ${ai}), but it was not evaluated in the accumulated pipeline.`,
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

function computeJoinOrderBadness(
  maxTupleCount: number,
  maxDependentPredicateSize: number,
  resultSize: number,
): number {
  return maxTupleCount / Math.max(maxDependentPredicateSize, resultSize);
}

/**
 * A bucket contains the pointwise sum of the tuple counts, result sizes and dependent predicate sizes
 * For each (predicate, order) in an SCC, we will compute a bucket.
 */
interface Bucket {
  tupleCounts: Int32Array;
  resultSize: number;
  dependentPredicateSizes: Map<string, number>;
}

class PredicateSizeScanner {
  // Map a predicate hash to its result size
  readonly predicateSizes = new Map<string, number>();
  readonly layerEvents = new Map<string, Array<ComputeRecursive | InLayer>>();

  onEvent(event: SummaryEvent): void {
    if (
      event.completionType !== undefined &&
      event.completionType !== "SUCCESS"
    ) {
      return; // Skip any evaluation that wasn't successful
    }
    switch (event.evaluationStrategy) {
      case "EXTENSIONAL":
      case "COMPUTED_EXTENSIONAL":
      case "COMPUTE_SIMPLE":
      case "CACHACA":
      case "CACHE_HIT": {
        this.predicateSizes.set(event.raHash, event.resultSize);
        break;
      }
      case "SENTINEL_EMPTY": {
        this.predicateSizes.set(event.raHash, 0);
        break;
      }
      case "COMPUTE_RECURSIVE":
      case "IN_LAYER": {
        this.predicateSizes.set(event.raHash, event.resultSize);
        // layerEvents are indexed by the mainHash.
        const hash = getMainHash(event);
        if (!this.layerEvents.has(hash)) {
          this.layerEvents.set(hash, []);
        }
        this.layerEvents.get(hash)!.push(event);
        break;
      }
    }
  }
}

class JoinOrderScanner {
  constructor(
    private readonly predicateSizes: Map<string, number>,
    private readonly layerEvents: Map<
      string,
      Array<ComputeRecursive | InLayer>
    >,
    private readonly problemReporter: EvaluationLogProblemReporter,
    private readonly warningThreshold: number,
  ) {}

  public onEvent(event: SummaryEvent): void {
    if (
      event.completionType !== undefined &&
      event.completionType !== "SUCCESS"
    ) {
      return; // Skip any evaluation that wasn't successful
    }
    switch (event.evaluationStrategy) {
      case "COMPUTE_SIMPLE": {
        if (!event.pipelineRuns) {
          // skip if the optional pipelineRuns field is not present.
          break;
        }
        // Compute the badness metric for a non-recursive predicate. The metric in this case is defined as:
        // badness = (max tuple count in the pipeline) / (largest predicate this pipeline depends on)
        const resultSize = event.resultSize;

        // There is only one entry in `pipelineRuns` if it's a non-recursive predicate.
        const { maxTupleCount, maxDependentPredicateSize } =
          this.badnessInputsForNonRecursiveDelta(event.pipelineRuns[0], event);

        if (maxDependentPredicateSize > 0) {
          const metric = computeJoinOrderBadness(
            maxTupleCount,
            maxDependentPredicateSize,
            resultSize!,
          );
          if (metric >= this.warningThreshold) {
            const message = `'${event.predicateName}@${event.raHash.substring(
              0,
              8,
            )}' has an inefficient join order. Its join order metric is ${metric.toFixed(
              2,
            )}, which is larger than the threshold of ${this.warningThreshold.toFixed(
              2,
            )}.`;
            this.problemReporter.reportProblemNonRecursive(
              event.predicateName,
              event.raHash,
              message,
            );
          }
        }
        break;
      }

      case "COMPUTE_RECURSIVE": {
        // Compute the badness metric for a recursive predicate for each ordering.
        const sccMetricInput = this.badnessInputsForRecursiveDelta(event);
        // Loop through each predicate in the SCC
        sccMetricInput.forEach((hashToOrderToBucket, predicateName) => {
          hashToOrderToBucket.forEach((orderToBucket, raHash) => {
            // Loop through each ordering of the predicate.
            orderToBucket.forEach((bucket, raReference) => {
              const maxDependentPredicateSize = Math.max(
                ...bucket.dependentPredicateSizes.values(),
              );

              if (maxDependentPredicateSize > 0) {
                const maxTupleCount = Math.max(...bucket.tupleCounts);
                const resultSize = bucket.resultSize;
                const metric = computeJoinOrderBadness(
                  maxTupleCount,
                  maxDependentPredicateSize,
                  resultSize,
                );
                if (metric >= this.warningThreshold) {
                  const message = `The ${raReference} pipeline for '${predicateName}@${raHash.substring(
                    0,
                    8,
                  )}' has an inefficient join order. Its join order metric is ${metric.toFixed(
                    2,
                  )}, which is larger than the threshold of ${this.warningThreshold.toFixed(
                    2,
                  )}.`;
                  this.problemReporter.reportProblemForRecursionSummary(
                    predicateName,
                    raHash,
                    raReference,
                    message,
                  );
                }
              }
            });
          });
        });
        break;
      }
    }
  }

  /**
   * Iterate through an SCC with main node `event`.
   */
  private iterateSCC(
    event: ComputeRecursive,
    func: (
      inLayerEvent: ComputeRecursive | InLayer,
      run: PipelineRun,
      iteration: number,
    ) => void,
  ): void {
    const sccEvents = this.layerEvents.get(event.raHash)!;
    const nextPipeline: number[] = new Array(sccEvents.length).fill(0);

    const maxIteration = Math.max(
      ...sccEvents.map((e) => e.predicateIterationMillis.length),
    );

    for (let iteration = 0; iteration < maxIteration; ++iteration) {
      // Loop through each predicate in this iteration
      for (let predicate = 0; predicate < sccEvents.length; ++predicate) {
        const inLayerEvent = sccEvents[predicate];
        const iterationTime =
          inLayerEvent.predicateIterationMillis.length <= iteration
            ? -1
            : inLayerEvent.predicateIterationMillis[iteration];
        if (iterationTime !== -1) {
          const run: PipelineRun =
            inLayerEvent.pipelineRuns[nextPipeline[predicate]++];
          func(inLayerEvent, run, iteration);
        }
      }
    }
  }

  /**
   * Compute the maximum tuple count and maximum dependent predicate size for a non-recursive pipeline
   */
  private badnessInputsForNonRecursiveDelta(
    pipelineRun: PipelineRun,
    event: ComputeSimple,
  ): { maxTupleCount: number; maxDependentPredicateSize: number } {
    const dependentPredicateSizes = Object.values(event.dependencies).map(
      (hash) => this.predicateSizes.get(hash) ?? 0, // Should always be present, but zero is a safe default.
    );
    const maxDependentPredicateSize = safeMax(dependentPredicateSizes);
    return {
      maxTupleCount: safeMax(pipelineRun.counts),
      maxDependentPredicateSize,
    };
  }

  private prevDeltaSizes(
    event: ComputeRecursive,
    predicate: string,
    i: number,
  ) {
    // If an iteration isn't present in the map it means it was skipped because the optimizer
    // inferred that it was empty. So its size is 0.
    return this.curDeltaSizes(event, predicate, i - 1);
  }

  private curDeltaSizes(event: ComputeRecursive, predicate: string, i: number) {
    // If an iteration isn't present in the map it means it was skipped because the optimizer
    // inferred that it was empty. So its size is 0.
    return (
      this.layerEvents
        .get(event.raHash)
        ?.find((x) => x.predicateName === predicate)?.deltaSizes[i] ?? 0
    );
  }

  /**
   * Compute the metric dependent predicate sizes and the result size for a predicate in an SCC.
   */
  private badnessInputsForLayer(
    event: ComputeRecursive,
    inLayerEvent: InLayer | ComputeRecursive,
    raReference: string,
    iteration: number,
  ) {
    const dependentPredicates = getDependentPredicates(
      inLayerEvent.ra[raReference],
    );
    let dependentPredicateSizes: Map<string, number>;
    // We treat the base case as a non-recursive pipeline. In that case, the dependent predicates are
    // the dependencies of the base case and the cur_deltas.
    if (raReference === "base") {
      dependentPredicateSizes = dependentPredicates
        .map((pred): [string, number] => {
          // A base case cannot contain a `prev_delta`, but it can contain a `cur_delta`.
          let size = 0;
          if (pred.endsWith("#cur_delta")) {
            size = this.curDeltaSizes(
              event,
              pred.slice(0, -"#cur_delta".length),
              iteration,
            );
          } else {
            const hash = event.dependencies[pred];
            size = this.predicateSizes.get(hash)!;
          }
          return [pred, size];
        })
        .reduce((acc, [pred, size]) => acc.set(pred, size), new Map());
    } else {
      // It's a non-base case in a recursive pipeline. In that case, the dependent predicates are
      // only the prev_deltas.
      dependentPredicateSizes = dependentPredicates
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
          const size = this.prevDeltaSizes(event, prev, iteration);
          return [prev, size];
        })
        .reduce((acc, [pred, size]) => acc.set(pred, size), new Map());
    }

    const deltaSize = inLayerEvent.deltaSizes[iteration];
    return { dependentPredicateSizes, deltaSize };
  }

  /**
   * Compute the metric input for all the events in a SCC that starts with main node `event`
   */
  private badnessInputsForRecursiveDelta(
    event: ComputeRecursive,
  ): Map<string, Map<string, Map<string, Bucket>>> {
    // nameToHashToOrderToBucket : predicate name -> RA hash -> ordering (i.e., standard, order_500000, etc.) -> bucket
    const nameToHashToOrderToBucket = new Map<
      string,
      Map<string, Map<string, Bucket>>
    >();

    // Iterate through the SCC and compute the metric inputs
    this.iterateSCC(event, (inLayerEvent, run, iteration) => {
      const raReference = run.raReference;
      const predicateName = inLayerEvent.predicateName;
      if (!nameToHashToOrderToBucket.has(predicateName)) {
        nameToHashToOrderToBucket.set(predicateName, new Map());
      }
      const hashToOrderToBucket = nameToHashToOrderToBucket.get(predicateName)!;
      const raHash = inLayerEvent.raHash;
      if (!hashToOrderToBucket.has(raHash)) {
        hashToOrderToBucket.set(raHash, new Map());
      }
      const orderToBucket = hashToOrderToBucket.get(raHash)!;
      if (!orderToBucket.has(raReference)) {
        orderToBucket.set(raReference, {
          tupleCounts: new Int32Array(0),
          resultSize: 0,
          dependentPredicateSizes: new Map(),
        });
      }

      const { dependentPredicateSizes, deltaSize } = this.badnessInputsForLayer(
        event,
        inLayerEvent,
        raReference,
        iteration,
      );

      const bucket = orderToBucket.get(raReference)!;
      // Pointwise sum the tuple counts
      const newTupleCounts = pointwiseSum(
        bucket.tupleCounts,
        new Int32Array(run.counts),
        this.problemReporter,
      );
      const resultSize = bucket.resultSize + deltaSize;

      // Pointwise sum the deltas.
      const newDependentPredicateSizes = new Map<string, number>(
        bucket.dependentPredicateSizes,
      );
      for (const [pred, size] of dependentPredicateSizes) {
        newDependentPredicateSizes.set(
          pred,
          (newDependentPredicateSizes.get(pred) ?? 0) + size,
        );
      }

      orderToBucket.set(raReference, {
        tupleCounts: newTupleCounts,
        resultSize,
        dependentPredicateSizes: newDependentPredicateSizes,
      });
    });
    return nameToHashToOrderToBucket;
  }
}

export async function scanAndReportJoinOrderProblems(
  jsonSummaryLocation: string,
  problemReporter: EvaluationLogProblemReporter,
  warningThreshold: number,
) {
  // Do two passes over the summary JSON. The first pass collects the sizes of predicates, along
  // with collecting layer events for each recursive SCC.
  const predicateSizeScanner = new PredicateSizeScanner();
  await readJsonlFile<SummaryEvent>(jsonSummaryLocation, async (obj) => {
    predicateSizeScanner.onEvent(obj);
  });

  // The second pass takes the information from the first pass, computes join order scores, and reports those that exceed the threshold.
  const joinOrderScanner = new JoinOrderScanner(
    predicateSizeScanner.predicateSizes,
    predicateSizeScanner.layerEvents,
    problemReporter,
    warningThreshold,
  );
  await readJsonlFile<SummaryEvent>(jsonSummaryLocation, async (obj) => {
    joinOrderScanner.onEvent(obj);
  });
}
