import * as fs from "fs";
import { Protocol as P } from "devtools-protocol";

export interface Position {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  url: string;
}

export interface RAHashable {
  raHash: string;
  completionTime: string;
  position: Position;
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
 * Filters out rows that don't contain all the necessary fields.
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

  if (!("position" in row)) {
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
 * Decodes a position string into a position object.
 * @param position The position string.
 * @returns A decoded position object.
 */
export function decodePositionFromString(position: string): Position {
  const lastColon = position.lastIndexOf(":");

  const positionPart = position.substring(lastColon + 1);
  const urlPart = position.substring(0, lastColon);

  const parts = positionPart.split("-");
  const startLine = parts[0].split(",")[0];
  const startColumn = parts[0].split(",")[1];
  const endLine = parts[1].split(",")[0];
  const endColumn = parts[1].split(",")[1];

  return {
    url: urlPart,
    startLine: parseInt(startLine),
    startColumn: parseInt(startColumn),
    endLine: parseInt(endLine),
    endColumn: parseInt(endColumn),
  };
}

/**
 * Converts a JSON log to an array of RAHashable objects.
 * @param log The JSON log to convert.
 * @returns An array of RAHashable objects.
 */
export function jsonLogToRALog(log: any[]): RAHashable[] {
  const raRows: RAHashable[] = [];

  for (const row of log) {
    // only let these rows contribute
    if (
      !(
        row.evaluationStrategy === "COMPUTE_SIMPLE" ||
        row.evaluationStrategy === "COMPUTE_RECURSIVE" ||
        row.evaluationStrategy === "EXTENSIONAL" ||
        row.evaluationStrategy === "COMPUTED_EXTENSIONAL"
      )
    ) {
      continue;
    }

    row.completionTimeUs = new Date(row.completionTime).getTime() * 1000;
    row.position = decodePositionFromString(row.position);

    const raHashableRow = row as RAHashable;

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
 * Gets the execution bounds of a RA log in terms of the min and max completionTimeUs. Note that this works by
 * iterating over the entire log and summing the reported execution times. The reported `min` time is
 * simply the first timestamp we see.
 * @param raLog The log
 * @returns the ExecutionBounds for the given log.
 */
export function getExecutionBounds(raLog: RAHashable[]): ExecutionBounds {
  let tsMax = 0;
  let tsMin = 0;

  let tsSum = 0;

  for (const row of raLog) {
    tsSum = tsSum + row.millis * 1000;

    if (tsMin === 0 || row.completionTimeUs < tsMin) {
      tsMin = row.completionTimeUs;
    }
  }

  // the max is the min + the sum of all the millis
  tsMax = tsMin + tsSum;

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
        scriptId: `${e.raHash}`,
        url: `${e.position.url}`,
        lineNumber: e.position.startLine - 1, // the profiler expects 0-based line numbers
        columnNumber: e.position.startColumn,
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
  /// Deltas -- this is the difference in time between the two samples.
  //  Each sample must have at least 1ms of time (otherwise we will travel
  //  back in time).
  ///
  //profile.timeDeltas = raRows.map((e) => Math.max(e.millis, 1) * 1000);
  profile.timeDeltas = raRows.map((e) => e.millis * 1000);

  ///
  /// Write out the profile
  ///
  fs.writeFileSync(outFile, JSON.stringify(profile));

  return outFile;
}
