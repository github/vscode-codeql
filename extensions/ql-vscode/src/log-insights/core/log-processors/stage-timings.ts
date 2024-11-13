import { existsSync } from "fs";
// eslint-disable-next-line import/no-namespace
import * as I from "immutable";
import type { CachedPredicateList, PipelineEvent, StageInfo } from "../types";
import {
  LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE,
  getQueryId,
  log,
  streamJsonl,
  warn,
  writeJson,
} from "../util";

/**
 * Gets the stage timings from an `predicates` summary of an evaluator log file.
 *
 * The resulting file is a JSON-encoded value of type {@link StageTimings}.
 *
 * If `expensivePredicatesFile` already exists, it is not overwritten.
 */
export async function process(
  codeqlPath: string,
  summaryPredicatesFile: string,
  stageTimingsFile: string,
): Promise<void> {
  if (existsSync(stageTimingsFile)) {
    // warn, but reuse existing file
    log(`Reusing existing ${stageTimingsFile}.`);
    return;
  }
  writeJson(
    stageTimingsFile,
    await getStageTimings(codeqlPath, summaryPredicatesFile),
  );
}

/**
 * A map from a stage name to the number of milliseconds it took to compute that stage.
 */
export type StageTimings = Record<string, number>;

function isCached(e: PipelineEvent): boolean {
  return e.isCached ?? false;
}

/**
 * INTERNAL: Do not use.
 *
 * This module is only exposed for testing purposes.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Internal {
  // 36 is the radix for numbers that use digits in the set [0-9a-z].
  const BASE_FOR_HASH = 36;

  /** Convert a string to a bigint in base BASE_FOR_HASH. */
  export function convert(value: string): bigint {
    return [...value].reduce(
      (r, v) => r * BigInt(BASE_FOR_HASH) + BigInt(parseInt(v, BASE_FOR_HASH)),
      BigInt(0),
    );
  }

  /** Returns a hash of `predicates`. */
  export function computeHashForCachedPredicateList(
    predicates: CachedPredicateList,
  ): string {
    return predicates
      .reduce((h, { raHash }) => h ^ Internal.convert(raHash), BigInt(0))
      .toString(BASE_FOR_HASH);
  }

  /**
   * Returns two entities calculated from `event`:
   * - `stagesForQuery`: Maps a query name to the set of stage numbers that
   * this query depends on.
   * - `cachedPredicate`: If `event` represents the evaluation of a cached
   * predicate, this record holds the RA hash and the name of the cached
   * predicate.
   *
   * Furthermore, the `lastStageForQuery` map is updated to record the last
   * stage for a given query in case `event` is used in a later stage than
   * what has been observed so far.
   */
  export function computeStagesAndLastMaps(
    event: PipelineEvent,
    lastStageForQuery: Map<string, number>,
  ): {
    stagesForQuery: Map<string, Set<number>>;
    cachedPredicate?: { raHash: string; predName: string };
  } {
    const stagesForQuery = new Map<string, Set<number>>();
    Object.values(event.appearsAs).map((appearsAs) => {
      Object.entries(appearsAs).map(([queryName, stages]) => {
        const finalStage = Math.max(...stages);
        // Remember last stage
        lastStageForQuery.set(
          queryName,
          Math.max(lastStageForQuery.get(queryName) ?? -1, finalStage),
        );
        stagesForQuery.set(
          queryName,
          new Set([
            ...(stagesForQuery.get(queryName) ?? new Set<number>()),
            ...stages,
          ]),
        );
      });
    });
    if (isCached(event)) {
      const cachedPredicate = {
        raHash: event.raHash,
        predName: event.predicateName,
      };

      return {
        stagesForQuery,
        cachedPredicate,
      };
    } else {
      return {
        stagesForQuery,
      };
    }
  }

  /**
   * Parses a computed extensinoal name of the form (prefix)(module)::(name)#(suffix)
   * and returns the `module` and the `name` if parsing succeeded, and
   * `undefined` otherwise.
   */
  export function parseComputedExtensionalName(predicateName: string):
    | {
        module: string;
        name: string;
      }
    | undefined {
    // matches a regex of the form (module)::(name)#suffix with an optional m#
    // prefix (denoting magic).
    const matches = predicateName.match(
      /^(m#)?([^#]+)::([^#]+(?:#dispred)?)#.+$/,
    );
    if (matches) {
      return {
        module: matches[2],
        // Include the magic prefix if its there.
        name: (matches[1] ?? "") + matches[3],
      };
    }
    return undefined;
  }

  /**
   * Returns a short name description of the cached predicates in `xs`.
   *
   * The list of predicates is shortened according to the following rules:
   * - If the list is a singleton, the short name is just the name of the
   * unique predicate in the list.
   * - Otherwise, we return a list of the form `module1#n1#module2#n2#...#moduleN#nN`
   * where `module1` has `n1` cached predicates, `module2` has `n2` cached predicate,
   * etc.
   *
   * This scheme ensures that the name of a stage is relatively stable across most
   * QL changes (unless it changes which predicates are evaluated in a stage).
   */
  export function computeShortName(xs: CachedPredicateList): string {
    // If there's just one cached predicate then we return the name of that one
    if (xs.length === 1) {
      const moduleAndName = parseComputedExtensionalName(xs[0].predName);
      if (!moduleAndName) {
        warn(
          `Could not extract module and name from the raw predicate name ${xs[0].predName}.`,
        );
        return "ERROR_SHORT_NAME";
      }
      const { module, name } = moduleAndName;
      return `${module}::${name}`;
    }
    // Otherwise, we collect all the cached predicates and return a name of the form
    // module1#n1#module2#n2#...
    // where there are n1 cached predicates from module1, n2 cached predicates from module2, etc.
    const moduleMap = new Map<string, number>();
    for (const { predName } of xs) {
      const moduleAndName = parseComputedExtensionalName(predName);
      if (!moduleAndName) {
        warn(
          `Could not extract module and name from the raw predicate name ${predName}).`,
        );
        continue;
      }
      const { module } = moduleAndName;
      const count = moduleMap.get(module) ?? 0;
      moduleMap.set(module, count + 1);
    }

    return Array.from(moduleMap.entries())
      .sort(([module1], [module2]) => module1.localeCompare(module2))
      .map(([module, n]) => `${module}#${n}`)
      .join("#");
  }

  /**
   * Given a query name and a stage number with stage info `info` this function
   * returns a suitable key for the `stageMap` datastructure used in `getStageTimings`.
   *
   * The key consists of a hash of the cached predicates of the stage and the short name
   * of the stage.
   */
  export function computeStageMapEntry(
    codeqlPath: string,
    queryName: string,
    stageNumber: number,
    info: StageInfo,
    lastStageForQuery: Map<string, number>,
  ) {
    const makeStageMapKey = I.Record({ hash: "", shortName: "", millis: -1 });

    let hash: string;
    let shortName: string;
    if (info.cachedPredicateList.length > 0) {
      hash = Internal.computeHashForCachedPredicateList(
        info.cachedPredicateList,
      );
      shortName = Internal.computeShortName(info.cachedPredicateList);
    } else if (stageNumber === lastStageForQuery.get(queryName)) {
      hash = info.lastRaHash;
      shortName = getQueryId(codeqlPath, queryName);
    } else {
      hash = info.lastRaHash;
      shortName = info.lastPredName;
    }
    const key = makeStageMapKey({
      hash,
      shortName,
      millis: info.millis,
    });

    return key;
  }
}

/**
 * Returns a promise that computes the list of stages and the evaluation time of each
 * stage evaluated in the run that produced the structured log file `evaluatorSummaryFile`.
 */
async function getStageTimings(
  codeqlPath: string,
  evaluatorSummaryFile: string,
): Promise<StageTimings> {
  // stageInfo : (query name, stage number) -> StageInfo
  const stageInfo = I.Map<
    I.Record<{ queryName: string; stageNumber: number }>,
    StageInfo
  >().asMutable();
  const makeStageInfoKey = I.Record({
    queryName: "",
    stageNumber: -1,
  });

  // lastStage : query name -> max stage number
  const lastStageForQuery = new Map<string, number>();

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
      if (!event.evaluationStrategy) {
        return;
      }

      const { stagesForQuery, cachedPredicate } =
        Internal.computeStagesAndLastMaps(event, lastStageForQuery);
      const millis: number = ("millis" in event && event.millis) || 0;

      const maxNumberOfStages = Math.max(
        ...Array.from(stagesForQuery).map(([_, stages]) => stages.size),
      );
      const millisPerStage = Math.floor(millis / maxNumberOfStages);

      for (const [queryName, stages] of stagesForQuery) {
        for (const stage of stages) {
          // Update stage information
          const key = makeStageInfoKey({ queryName, stageNumber: stage });
          const oldMillis = stageInfo.get(key)?.millis ?? 0;
          const oldCachedPredicateList =
            stageInfo.get(key)?.cachedPredicateList ?? [];
          stageInfo.set(key, {
            millis: oldMillis + millisPerStage,
            lastRaHash: event.raHash,
            lastPredName: event.predicateName,
            cachedPredicateList: oldCachedPredicateList.concat(
              cachedPredicate ? cachedPredicate : [],
            ),
          });
        }
      }
    },
  );

  log(
    `Obtain stage info for ${stageInfo.size} (queryName, stageNumber) pairs...`,
  );
  // "stage name" and "time" are expected to be functionally determined by the "stage hash", but are included in the key just in case.
  // stageMap : (stage hash, stage name, time) -> (query name, stage number) list
  type QueryNameAndStageNumber = { queryName: string; stageNumber: number };
  const stageMap = I.Map<
    I.Record<{ hash: string; shortName: string; millis: number }>,
    QueryNameAndStageNumber[]
  >().asMutable();

  // Compute pretty names for stages and keep a map from stage (hash, name, time)
  // to query name and stage number
  for (const [stageInfoKey, info] of stageInfo) {
    const queryName: string = stageInfoKey.get("queryName");
    const stageNumber: number = stageInfoKey.get("stageNumber");

    const key = Internal.computeStageMapEntry(
      codeqlPath,
      queryName,
      stageNumber,
      info,
      lastStageForQuery,
    );
    const oldEntries = stageMap.get(key) ?? [];

    stageMap.set(key, oldEntries.concat({ queryName, stageNumber }));
  }

  // stageTimings : stage name -> (timing, query name, stage number, query count) list
  const deduplicatedStageMap = new Map<
    string,
    Array<{
      millis: number;
      queryNameAndStageNumber: QueryNameAndStageNumber;
      queryCount: number;
    }>
  >();

  stageMap.forEach((queryNamesAndStages, key) => {
    const shortName = key.get("shortName");
    const millis = key.get("millis");
    const queryNameAndStageNumber = queryNamesAndStages.sort(
      ({ queryName: q1 }, { queryName: q2 }) => q1.localeCompare(q2),
    )[0];
    const timing = deduplicatedStageMap.get(shortName) ?? [];
    deduplicatedStageMap.set(
      shortName,
      timing.concat({
        millis,
        queryNameAndStageNumber,
        queryCount: queryNamesAndStages.length,
      }),
    );
  });

  log(
    `Deduplication reduced stageMap from ${stageMap.size} to ${deduplicatedStageMap.size} entries`,
  );

  // Map from stage name to milliseconds
  const timingMap = new Map<string, number>();

  for (const [shortName, timings] of deduplicatedStageMap) {
    const totalQueryCount = timings.reduce((c, t) => c + t.queryCount, 0);
    if (totalQueryCount === 1 && !shortName.includes("#")) {
      timingMap.set(shortName, timings[0].millis);
    } else {
      for (const { millis, queryNameAndStageNumber, queryCount } of timings) {
        const { queryName, stageNumber } = queryNameAndStageNumber;
        const timingKey = `${shortName}(${getQueryId(
          codeqlPath,
          queryName,
        )}[${stageNumber}], ${queryCount}/${totalQueryCount})`;
        timingMap.set(timingKey, millis);
      }
    }
  }

  log(`Computed stage timings for ${timingMap.size} timing keys`);
  return Object.fromEntries(timingMap);
}
