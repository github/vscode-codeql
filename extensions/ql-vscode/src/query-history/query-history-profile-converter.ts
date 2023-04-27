import * as fs from "fs";
import { Protocol as P } from "devtools-protocol";

export interface RAHashable {
  raHash: string;
  completionTime: string;
  completionTimeUs: number;
  evaluationStrategy: string;
  dependencies?: any;
  millis: number;
  predicateName: string;
}
export interface RAIndexed {
  ra: RAHashable;
  index: number;
}

export interface ExecutionBounds {
  min: number;
  max: number;
}

/**
 * Creates a lookup index for a set of RAHashable objects.
 * @param ras The RAHashable objects to index.
 * @returns a map of RAHashable objects to their index.
 */
export function indexRaElements(ras: RAHashable[]): Map<string, RAIndexed> {
  const raHashIndex = new Map<string, RAIndexed>();

  let idx = 1;
  for (const ra of ras) {
    // every row should have a raHash
    if (!raHashIndex.has(ra.raHash)) {
      raHashIndex.set(ra.raHash, {
        index: idx,
        ra,
      });

      idx++;
    }
  }
  return raHashIndex;
}

/**
 * Both of these properties are needed for each row so this function will provide a
 * way to filter them out.
 * @param row
 * @returns true if the row is not a compute row.
 */
export function isNonComputeRow(row: any) {
  if (!("completionTime" in row)) {
    return true;
  }

  if (!("predicateName" in row)) {
    return true;
  }

  return false;
}

/**
 * Converts a JSON evaluator log summary to an array of javascript objects.
 * @param log The path to the log.
 * @param filterNonCompute If non-compute nodes should be filtered.
 * @returns
 */
export function jsonLogToArrayOfJSON(
  log: string,
  filterNonCompute = true,
): any[] {
  const data = fs.readFileSync(log, "utf8");

  // split up the log
  const parts = data.split("\n\n");
  const rows: any = [];

  for (const row of parts) {
    const j = JSON.parse(row);

    if (filterNonCompute && isNonComputeRow(j)) {
      continue;
    }

    rows.push(j);
  }

  return rows;
}

/**
 * Converts a JSON log to an array of RAHashable objects.
 * @param log The JSON log to convert.
 * @returns An array of RAHashable objects.
 */
export function jsonLogToRALog(log: any[]): RAHashable[] {
  const raRows: RAHashable[] = [];

  for (const row of log) {
    row.completionTimeUs = new Date(row.completionTime).getTime() * 1000;

    const raHashableRow = row as RAHashable;

    // only let these rows contribute
    if (
      !(
        raHashableRow.evaluationStrategy === "COMPUTE_SIMPLE" ||
        raHashableRow.evaluationStrategy === "COMPUTE_RECURSIVE" ||
        raHashableRow.evaluationStrategy === "EXTENSIONAL"
      )
    ) {
      continue;
    }

    raRows.push(raHashableRow);
  }

  return raRows;
}

/**
 * Because some dependencies may be missing in the filtered log, we need to prune them. This
 * function will prune out orphaned dependencies.
 * @param raLog The RA log to filter.
 * @param raDatabase An index of all RA rows.
 */
export function pruneRADependencies(
  raLog: RAHashable[],
  raDatabase: Map<string, RAIndexed>,
) {
  raLog.forEach((e) => {
    const deps: any = {};

    for (const k in e.dependencies) {
      if (raDatabase.has(e.dependencies[k])) {
        deps[k] = e.dependencies[k];
      }
    }

    e.dependencies = deps;
  });
}

/**
 * Gets the execution bounds of a RA log in terms of the min and max completionTimeUs.
 * @param raLog The log
 * @returns the ExecutionBounds for the given log.
 */
export function getExecutionBounds(raLog: RAHashable[]): ExecutionBounds {
  let tsMax = 0;
  let tsMin = 0;

  for (const row of raLog) {
    if (tsMax < row.completionTimeUs) {
      tsMax = row.completionTimeUs;
    }

    if (tsMin === 0 || row.completionTimeUs < tsMin) {
      tsMin = row.completionTimeUs;
    }
  }

  return {
    min: tsMin,
    max: tsMax,
  } as ExecutionBounds;
}

/**
 * Converts a JSON summary evaluator log to a cpuprofiler format. Documentation on this
 * format can be found here: https://chromedevtools.github.io/devtools-protocol/tot/Profiler/#type-Profile
 *
 * @param evaluatorLog The JSON evaluator log as a summary, non-minified.
 * @param outFile Where the cpuprofiler file should be written to.
 * @returns The file it wrote to.
 */
export function convertJSONSummaryEvaluatorLog(
  evaluatorLog: string,
  outFile: string,
): string {
  ///
  /// First we do the main conversion from the JSON log to RA format which is
  /// a more compact representation of the log annotated with the raHash along
  /// with an index so that we can restructure it into a graph as expected by the
  /// profiler format.
  ///

  // convert the log to an array of JSON objects in RA format.
  // we sort the resulting array by completionTimeUs
  const raRows = jsonLogToRALog(jsonLogToArrayOfJSON(evaluatorLog)).sort(
    (a, b) => a.completionTimeUs - b.completionTimeUs,
  );

  // create an index of the raHashes for faster lookups
  const raDatabase: Map<string, RAIndexed> = indexRaElements(raRows);

  // filter the raRows dependencies since it is possible some of the dependencies
  // reference things that may not exist in the final graph
  pruneRADependencies(raRows, raDatabase);

  // build up graph
  //console.log(raDatabase.size)
  const executionBounds: ExecutionBounds = getExecutionBounds(raRows);

  const profile: P.Profiler.Profile = {
    nodes: [],
    startTime: executionBounds.min,
    endTime: executionBounds.max,
    samples: [],
    timeDeltas: [],
  };

  ///
  /// Compute the profile nodes.
  ///
  profile.nodes = raRows.map((e) => {
    // compute the dependencies
    const dependencies: number[] = [];

    if (e.dependencies) {
      for (const k in e.dependencies) {
        dependencies.push(raDatabase.get(e.dependencies[k])!.index);
      }
    }

    const n: P.Profiler.ProfileNode = {
      id: raDatabase.get(e.raHash)!.index,
      callFrame: {
        functionName: e.predicateName,
        scriptId: "0",
        url: "",
        lineNumber: 0,
        columnNumber: 0,
      },
      hitCount: 1, // everything will have just one hit.
      children: dependencies,
    };
    return n;
  });

  ///
  /// Compute samples -- this is really just every id once.
  ///
  profile.samples = raRows.map((e) => raDatabase.get(e.raHash)!.index);

  ///
  /// Deltas -- this is the difference in time between the two samples
  ///
  profile.timeDeltas = raRows.map((e) => e.millis * 1000);

  ///
  /// Write out the profile
  ///
  fs.writeFileSync(outFile, JSON.stringify(profile));

  return outFile;
}
