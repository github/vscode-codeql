import { createHash } from "crypto";
import type { SummaryEvent } from "./log-summary";

export interface PipelineSummary {
  steps: string[];
  /** Total counts for each step in the RA array, across all iterations */
  counts: number[];
  hash: string;
}

/**
 * Data extracted from a log for the purpose of doing a performance comparison.
 *
 * Memory compactness is important since we keep this data in memory; once for
 * each side of the comparison.
 *
 * This object must be able to survive a `postMessage` transfer from the extension host
 * to a web view (which rules out `Map` values, for example).
 */
export interface PerformanceComparisonDataFromLog {
  /**
   * Names of predicates mentioned in the log.
   *
   * For compactness, details of these predicates are stored in a "struct of arrays" style.
   *
   * All fields (except those ending with `Indices`) should contain an array of the same length as `names`;
   * details of a given predicate should be stored at the same index in each of those arrays.
   */
  names: string[];

  /** RA hash of the `i`th predicate event */
  raHashes: string[];

  /** Number of milliseconds spent evaluating the `i`th predicate from the `names` array. */
  timeCosts: number[];

  /** Number of tuples seen in pipelines evaluating the `i`th predicate from the `names` array. */
  tupleCosts: number[];

  /** Number of iterations seen when evaluating the `i`th predicate from the `names` array. */
  iterationCounts: number[];

  /** Number of executions of pipelines evaluating the `i`th predicate from the `names` array. */
  evaluationCounts: number[];

  /**
   * List of indices into the `names` array for which we have seen a cache hit.
   */
  cacheHitIndices: number[];

  /**
   * List of indices into the `names` array where the predicate was deemed empty due to a sentinel check.
   */
  sentinelEmptyIndices: number[];

  /**
   * All the pipeline runs seen for the `i`th predicate from the `names` array.
   */
  pipelineSummaryList: Array<Record<string, PipelineSummary>>;

  /** All dependencies of the `i`th predicate from the `names` array, encoded as a list of indices in `names`. */
  dependencyLists: number[][];
}

export class PerformanceOverviewScanner {
  private readonly data: PerformanceComparisonDataFromLog = {
    names: [],
    raHashes: [],
    timeCosts: [],
    tupleCosts: [],
    cacheHitIndices: [],
    sentinelEmptyIndices: [],
    pipelineSummaryList: [],
    evaluationCounts: [],
    iterationCounts: [],
    dependencyLists: [],
  };
  private readonly raToIndex = new Map<string, number>();
  private readonly mainHashToRepr = new Map<string, number>();
  private readonly nameToIndex = new Map<string, number>();

  private getPredicateIndex(name: string, ra: string): number {
    let index = this.raToIndex.get(ra);
    if (index === undefined) {
      index = this.raToIndex.size;
      this.raToIndex.set(ra, index);
      const {
        names,
        raHashes,
        timeCosts,
        tupleCosts,
        iterationCounts,
        evaluationCounts,
        pipelineSummaryList,
        dependencyLists,
      } = this.data;
      names.push(name);
      raHashes.push(ra);
      timeCosts.push(0);
      tupleCosts.push(0);
      iterationCounts.push(0);
      evaluationCounts.push(0);
      pipelineSummaryList.push({});
      dependencyLists.push([]);
    }
    return index;
  }

  getData(): PerformanceComparisonDataFromLog {
    return this.data;
  }

  onEvent(event: SummaryEvent): void {
    const { completionType, evaluationStrategy, predicateName, raHash } = event;
    if (completionType !== undefined && completionType !== "SUCCESS") {
      return; // Skip any evaluation that wasn't successful
    }

    switch (evaluationStrategy) {
      case "EXTENSIONAL": {
        break;
      }
      case "COMPUTED_EXTENSIONAL": {
        if (predicateName.startsWith("cached_")) {
          // Add a dependency from a cached COMPUTED_EXTENSIONAL to the predicate with the actual contents.
          // The raHash of the this event may appear in a CACHE_HIT event in the other event log. The dependency
          // we're adding here is needed in order to associate the original predicate with such a cache hit.
          const originalName = predicateName.substring("cached_".length);
          const originalIndex = this.nameToIndex.get(originalName);
          if (originalIndex != null) {
            const index = this.getPredicateIndex(predicateName, raHash);
            this.data.dependencyLists[index].push(originalIndex);
          }
        }
        break;
      }
      case "CACHE_HIT":
      case "CACHACA": {
        // Record a cache hit, but only if the predicate has not been seen before.
        // We're mainly interested in the reuse of caches from an earlier query run as they can distort comparisons.
        if (!this.raToIndex.has(raHash)) {
          this.data.cacheHitIndices.push(
            this.getPredicateIndex(predicateName, raHash),
          );
        }
        break;
      }
      case "SENTINEL_EMPTY": {
        const index = this.getPredicateIndex(predicateName, raHash);
        this.data.sentinelEmptyIndices.push(index);
        const sentinelIndex = this.raToIndex.get(event.sentinelRaHash);
        if (sentinelIndex != null) {
          this.data.dependencyLists[index].push(sentinelIndex); // needed for matching up cache hits
        }
        break;
      }
      case "COMPUTE_RECURSIVE":
      case "COMPUTE_SIMPLE":
      case "NAMED_LOCAL":
      case "IN_LAYER": {
        const index = this.getPredicateIndex(predicateName, raHash);
        this.nameToIndex.set(predicateName, index);
        let totalTime = 0;
        let totalTuples = 0;
        if (evaluationStrategy === "COMPUTE_SIMPLE") {
          totalTime += event.millis;
        } else {
          // Make a best-effort estimate of the total time by adding up the positive iteration times (they can be negative).
          // Note that for COMPUTE_RECURSIVE the "millis" field contain the total time of the SCC, not just that predicate,
          // but we don't have a good way to show that in the UI, so we rely on the accumulated iteration times.
          for (const millis of event.predicateIterationMillis ?? []) {
            if (millis > 0) {
              totalTime += millis;
            }
          }
        }
        const {
          timeCosts,
          tupleCosts,
          iterationCounts,
          evaluationCounts,
          pipelineSummaryList,
          dependencyLists,
        } = this.data;
        const pipelineSummaries = pipelineSummaryList[index];
        const dependencyList = dependencyLists[index];
        for (const { counts, raReference } of event.pipelineRuns ?? []) {
          // Get or create the pipeline summary for this RA
          const pipelineSummary = (pipelineSummaries[raReference] ??= {
            steps: event.ra[raReference],
            counts: counts.map(() => 0),
            hash: getPipelineHash(event.ra[raReference]),
          });
          const { counts: totalTuplesPerStep } = pipelineSummary;
          for (let i = 0, length = counts.length; i < length; ++i) {
            const count = counts[i];
            if (count < 0) {
              // Empty RA lines have a tuple count of -1. Do not count them when aggregating.
              // But retain the fact that this step had a negative count for rendering purposes.
              totalTuplesPerStep[i] = count;
              continue;
            }
            totalTuples += count;
            totalTuplesPerStep[i] += count;
          }
        }
        for (const dependencyHash of Object.values(event.dependencies ?? {})) {
          const dependencyIndex = this.raToIndex.get(dependencyHash);
          if (dependencyIndex != null) {
            dependencyList.push(dependencyIndex);
          }
        }
        // For predicates in the same SCC, add two-way dependencies with an arbitrary SCC member
        const sccHash =
          event.mainHash ??
          (evaluationStrategy === "COMPUTE_RECURSIVE" ? raHash : null);
        if (sccHash != null) {
          const mainIndex = this.mainHashToRepr.get(sccHash);
          if (mainIndex == null) {
            this.mainHashToRepr.set(sccHash, index);
          } else {
            dependencyLists[index].push(mainIndex);
            dependencyLists[mainIndex].push(index);
          }
        }
        timeCosts[index] += totalTime;
        tupleCosts[index] += totalTuples;
        iterationCounts[index] += event.pipelineRuns?.length ?? 0;
        evaluationCounts[index] += 1;
        break;
      }
    }
  }
}

function getPipelineHash(steps: string[]) {
  const md5 = createHash("md5");
  for (const step of steps) {
    md5.write(step);
  }
  return md5.digest("base64");
}
