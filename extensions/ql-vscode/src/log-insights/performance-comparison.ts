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
  /** Names of predicates mentioned in the log */
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
   *
   * TODO: only count cache hits prior to first evaluation?
   */
  cacheHitIndices: number[];

  /**
   * List of indices into the `names` array where the predicate was deemed empty due to a sentinel check.
   */
  sentinelEmptyIndices: number[];

  /**
   * All the pipeline runs seen for the `i`th predicate from the `names` array.
   *
   * TODO: replace with more compact representation
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
    if (
      event.completionType !== undefined &&
      event.completionType !== "SUCCESS"
    ) {
      return; // Skip any evaluation that wasn't successful
    }

    switch (event.evaluationStrategy) {
      case "EXTENSIONAL":
      case "COMPUTED_EXTENSIONAL":
      case "CACHACA": {
        // TODO: is CACHACA effectively the same as cache hit?
        break;
      }
      case "CACHE_HIT": {
        this.data.cacheHitIndices.push(
          this.getPredicateIndex(event.predicateName),
        );
        break;
      }
      case "SENTINEL_EMPTY": {
        this.data.sentinelEmptyIndices.push(
          this.getPredicateIndex(event.predicateName),
        );
        break;
      }
      case "COMPUTE_RECURSIVE":
      case "COMPUTE_SIMPLE":
      case "IN_LAYER": {
        const index = this.getPredicateIndex(event.predicateName);
        let totalTime = 0;
        let totalTuples = 0;
        if (event.evaluationStrategy === "COMPUTE_SIMPLE") {
          totalTime += event.millis;
        } else {
          for (const millis of event.predicateIterationMillis ?? []) {
            totalTime += millis;
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
            // TODO: possibly exclude unions here
            const count = counts[i];
            if (count < 0) {
              // Empty RA lines have a tuple count of -1. Do not count them when aggregating.
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
