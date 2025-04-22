import type { EvaluationLogScanner } from "./log-scanner";
import type { SummaryEvent } from "./log-summary";

export interface PipelineSummary {
  steps: string[];
  /** Total counts for each step in the RA array, across all iterations */
  counts: number[];
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
}

export class PerformanceOverviewScanner implements EvaluationLogScanner {
  private readonly nameToIndex = new Map<string, number>();
  private readonly data: PerformanceComparisonDataFromLog = {
    names: [],
    timeCosts: [],
    tupleCosts: [],
    cacheHitIndices: [],
    sentinelEmptyIndices: [],
    pipelineSummaryList: [],
    evaluationCounts: [],
    iterationCounts: [],
  };

  private getPredicateIndex(name: string): number {
    const { nameToIndex } = this;
    let index = nameToIndex.get(name);
    if (index === undefined) {
      index = nameToIndex.size;
      nameToIndex.set(name, index);
      const {
        names,
        timeCosts,
        tupleCosts,
        iterationCounts,
        evaluationCounts,
        pipelineSummaryList,
      } = this.data;
      names.push(name);
      timeCosts.push(0);
      tupleCosts.push(0);
      iterationCounts.push(0);
      evaluationCounts.push(0);
      pipelineSummaryList.push({});
    }
    return index;
  }

  getData(): PerformanceComparisonDataFromLog {
    return this.data;
  }

  onEvent(event: SummaryEvent): void {
    const { completionType, evaluationStrategy, predicateName } = event;
    if (completionType !== undefined && completionType !== "SUCCESS") {
      return; // Skip any evaluation that wasn't successful
    }

    switch (evaluationStrategy) {
      case "EXTENSIONAL":
      case "COMPUTED_EXTENSIONAL": {
        break;
      }
      case "CACHE_HIT":
      case "CACHACA": {
        // Record a cache hit, but only if the predicate has not been seen before.
        // We're mainly interested in the reuse of caches from an earlier query run as they can distort comparisons.
        if (!this.nameToIndex.has(predicateName)) {
          this.data.cacheHitIndices.push(this.getPredicateIndex(predicateName));
        }
        break;
      }
      case "SENTINEL_EMPTY": {
        this.data.sentinelEmptyIndices.push(
          this.getPredicateIndex(predicateName),
        );
        break;
      }
      case "COMPUTE_RECURSIVE":
      case "COMPUTE_SIMPLE":
      case "IN_LAYER": {
        const index = this.getPredicateIndex(predicateName);
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
        } = this.data;
        const pipelineSummaries = pipelineSummaryList[index];
        for (const { counts, raReference } of event.pipelineRuns ?? []) {
          // Get or create the pipeline summary for this RA
          const pipelineSummary = (pipelineSummaries[raReference] ??= {
            steps: event.ra[raReference],
            counts: counts.map(() => 0),
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
        timeCosts[index] += totalTime;
        tupleCosts[index] += totalTuples;
        iterationCounts[index] += event.pipelineRuns?.length ?? 0;
        evaluationCounts[index] += 1;
        break;
      }
    }
  }

  onDone(): void {}
}
