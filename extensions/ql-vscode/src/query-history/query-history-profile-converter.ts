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
 * Gets all the incoming edges for a given RA log.
 * @param raLog the RA log to get the incoming edges for.
 * @returns all of the incoming edges.
 */
export function getIncomingEdges(raLog: RAHashable[]): Set<string> {
  const incomingEdges: Set<string> = new Set<string>();

  for (const row of raLog) {
    for (const k in row.dependencies) {
      if (!incomingEdges.has(row.dependencies[k])) {
        incomingEdges.add(row.dependencies[k]);
      }
    }
  }

  return incomingEdges;
}

/**
 * Gets all the roots for a given RA log. A root is defined as a node that has no incoming edges.
 * @param raLog The RA log to get the roots for.
 * @returns A list of roots.
 */
export function getExecutionRoots(raLog: RAHashable[]): RAHashable[] {
  const roots: RAHashable[] = [];

  // first get all of the potential incoming edges.
  const incomingEdges = getIncomingEdges(raLog);

  for (const row of raLog) {
    // if there are no incoming edges
    if (!incomingEdges.has(row.raHash)) {
      roots.push(row);
    }
  }

  return roots;
}

/**
 * Gets the provided nodes in dependency order.
 * @param raRows a list of nodes.
 * @returns The dependency ordered nodes.
 */
export function getInDependencyOrder(raRows: RAHashable[]): RAHashable[] {
  const inDegree = new Map<string, RAIndexed>();
  const dependencyOrder: RAHashable[] = [];

  // set all indegrees to zero
  for (const row of raRows) {
    inDegree.set(row.raHash, {
      ra: row,
      index: 0,
    });
  }
  // compute indegree for each node
  for (const row of raRows) {
    // work over the indegrees of the
    for (const dep in row?.dependencies) {
      if (inDegree.has(row.dependencies[dep])) {
        const ra = inDegree.get(row.dependencies[dep])!;
        ra.index = ra.index + 1;
        inDegree.set(row.dependencies[dep], ra);
      } else {
        inDegree.set(row.dependencies[dep], {
          ra: row,
          index: 1,
        });
      }
    }
  }

  // Queue up all nodes with indegree 0 (which should really just
  // be the root of all execution).
  const queue: RAHashable[] = [];
  let numIterations = 0;

  for (const row of raRows) {
    if (inDegree.get(row.raHash)?.index === 0) {
      queue.push(row);
    }
  }

  while (queue.length > 0) {
    const vertex = queue.shift()!;
    dependencyOrder.push(vertex);

    // iterate over all dependencies
    // and decrease indegree by 1
    for (const n in vertex.dependencies) {
      const depdendencyHash = vertex.dependencies[n];
      if (inDegree.has(depdendencyHash)) {
        inDegree.get(depdendencyHash)!.index--;

        if (inDegree.get(depdendencyHash)!.index === 0) {
          queue.push(inDegree.get(depdendencyHash)!.ra);
        }
      }
    }
    numIterations++;
  }

  if (numIterations !== raRows.length) {
    //throw new Error("Cycle detected in dependency graph");
  }

  return dependencyOrder.reverse();
}
/**
 * Prunes all nodes that are unreachable from the given root.
 * @param raRows The rows to prune -- typically the output of getInDependencyOrder.
 * @param raDatabase The database to use for lookups.
 * @param root the root to consider as the starting point.
 */
export function pruneNodesUnreachableFromRoot(
  raRows: RAHashable[],
  raDatabase: Map<string, RAIndexed>,
  root: string,
): RAHashable[] {
  const queue: RAHashable[] = [raDatabase.get(root)!.ra];

  const visited = new Set<string>();

  while (queue.length > 0) {
    const vertex: RAHashable = queue.pop()!;

    if (!visited.has(vertex.raHash)) {
      visited.add(vertex.raHash);

      for (const k in vertex.dependencies) {
        const edge = raDatabase.get(vertex.dependencies[k]);

        if (edge !== undefined) {
          queue.push(edge.ra);
        }
      }
    }
  }

  const prunedRows = raRows.filter((row) => visited.has(row.raHash));

  // It is possible some dependencies were orphaned. So in that
  // case we need to remove them.
  const prunedDatabase = indexRaElements(prunedRows);
  pruneRADependencies(prunedRows, prunedDatabase);

  return prunedRows;
}
/**
 * Get the depth of a given hash root.
 * @param raRow the root.
 * @param raDatabase A lookup database.
 * @returns the depth of the root.
 */
export function getExecutionDepth(
  raRow: RAHashable,
  raDatabase: Map<string, RAIndexed>,
): number {
  let currentDepth = 0;
  let maxDepth = 0;

  const queue: RAHashable[] = [raRow];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const vertex: RAHashable = queue.pop()!;

    if (!visited.has(vertex.raHash)) {
      visited.add(vertex.raHash);

      const oldQLength = queue.length;

      for (const k in vertex.dependencies) {
        const edge = raDatabase.get(vertex.dependencies[k]);

        if (edge !== undefined) {
          queue.push(edge.ra);
        }
      }

      // we don't just increment the depth because
      // it is possible there are orphaned dependencies
      // that we actually don't have even though they
      // exist in the dependency list.
      if (queue.length > oldQLength) {
        currentDepth = currentDepth + 1;
      }
    } else {
      currentDepth = currentDepth - 1;
    }
    maxDepth = Math.max(maxDepth, currentDepth);
  }
  return maxDepth;
}

/**
 * Gets the deepest execution root from a list of RA rows.
 * @param raRows The roots to search.
 * @param raDatabase An index of all RA rows.
 * @returns The deepest execution root.
 */
export function getDeepestExecutionRoot(
  raRows: RAHashable[],
  raDatabase: Map<string, RAIndexed>,
): RAHashable | undefined {
  let executionRoot: RAHashable | undefined;
  let executionDepth = 0;

  const executionRoots = getExecutionRoots(raRows);

  for (const root of executionRoots) {
    const depth = getExecutionDepth(root, raDatabase);

    if (depth > executionDepth) {
      executionDepth = depth;
      executionRoot = root;
    }
  }

  return executionRoot;
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
  let raRows: RAHashable[] = jsonLogToRALog(
    jsonLogToArrayOfJSON(evaluatorLog),
  ).sort((a, b) => a.completionTimeUs - b.completionTimeUs);

  // create an index of the raHashes for faster lookups

  let raDatabase: Map<string, RAIndexed> = indexRaElements(raRows);

  // filter the raRows dependencies since it is possible some of the dependencies
  // reference things that may not exist in the final graph
  pruneRADependencies(raRows, raDatabase);

  // find the "root" to base execution off of. Because of the way that execution works
  // it is possible to end up with multiple roots. Some of these roots may be "orphaned"
  // and not used by the general computation path due to the way that the evaluator works.
  const executionRoot = getDeepestExecutionRoot(
    getExecutionRoots(raRows),
    raDatabase,
  );

  if (executionRoot === undefined) {
    throw new Error(
      "No execution root found. This is likely a bug in the profiler.",
    );
  }
  // compute the logical execution order of the RA rows
  const raRowsInDepOrder = getInDependencyOrder(raRows);

  // we want to exclude any paths that don't require the deepest execution root, so we
  // do that here.
  const prunedRows = pruneNodesUnreachableFromRoot(
    raRowsInDepOrder,
    raDatabase,
    executionRoot.raHash,
  );

  // swap out the raRows
  raRows = prunedRows;

  // this is not strictly necessary, but it is nice to have things
  // in a consistent order that is easy to check by hand. Namely,
  // we index the rows to give them sequential ids.
  raDatabase = indexRaElements(raRows);

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
        //url: `${e.position.url}`,
        url: `RA HASH: ${e.raHash}`, //`${e.position.url}`,
        lineNumber: e.position.startLine - 1, // the profiler expects 0-based line numbers
        columnNumber: e.position.startColumn,
      },
      hitCount: 1, // everything will have just one hit.
      children: dependencies,
    };
    return n;
  });

  //
  // Profiles require a root node that is the time before profiling starts. We
  // mock that up here.
  //
  const rootNode: P.Profiler.ProfileNode = {
    id: 0,
    callFrame: {
      functionName: "(root)",
      scriptId: "0",
      url: "",
      lineNumber: -1,
      columnNumber: -1,
    },
    hitCount: 0, // everything will have just one hit.
    children: [],
  };

  profile.nodes.unshift(rootNode);

  ///
  /// Compute samples -- this is really just every id once.
  ///
  profile.samples = raRows.map((e) => raDatabase.get(e.raHash)!.index);

  // Append the padding sample
  profile.samples.push(0);

  ///
  /// Deltas -- this is the difference in time between the two samples.
  //  Each sample must have at least 1ms of time (otherwise we will travel
  //  back in time).
  ///
  profile.timeDeltas = raRows.map((e) => e.millis * 1000);

  // Add in the bookend padding sample
  profile.timeDeltas.unshift(0);

  ///
  /// Write out the profile
  ///
  fs.writeFileSync(outFile, JSON.stringify(profile));

  return outFile;
}
