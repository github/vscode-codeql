import type { Location, Result as SarifResult, ThreadFlow } from "sarif";

/**
 * Identifies a result, a path, or one of the nodes on a path.
 */
interface ResultKeyBase {
  resultIndex: number;
  pathIndex?: number;
  pathNodeIndex?: number;
}

/**
 * Identifies one of the results in a result set by its index in the result list.
 */
export interface Result extends ResultKeyBase {
  resultIndex: number;
  pathIndex?: undefined;
  pathNodeIndex?: undefined;
}

/**
 * Identifies one of the paths associated with a result.
 */
interface Path extends ResultKeyBase {
  pathIndex: number;
  pathNodeIndex?: undefined;
}

/**
 * Identifies one of the nodes in a path.
 */
export interface PathNode extends ResultKeyBase {
  pathIndex: number;
  pathNodeIndex: number;
}

export type ResultKey = Result | Path | PathNode;

/**
 * Looks up a specific result in a result set.
 */
export function getResult(
  results: SarifResult[],
  key: Result | Path | PathNode,
): SarifResult | undefined {
  return results[key.resultIndex];
}

/**
 * Looks up a specific path in a result set.
 */
export function getPath(
  results: SarifResult[],
  key: Path | PathNode,
): ThreadFlow | undefined {
  const result = getResult(results, key);
  if (result === undefined) {
    return undefined;
  }
  let index = -1;
  if (result.codeFlows === undefined) {
    return undefined;
  }
  for (const codeFlows of result.codeFlows) {
    for (const threadFlow of codeFlows.threadFlows) {
      ++index;
      if (index === key.pathIndex) {
        return threadFlow;
      }
    }
  }
  return undefined;
}

/**
 * Looks up a specific path node in a result set.
 */
export function getPathNode(
  results: SarifResult[],
  key: PathNode,
): Location | undefined {
  const path = getPath(results, key);
  if (path === undefined) {
    return undefined;
  }
  return path.locations[key.pathNodeIndex]?.location;
}

/**
 * Returns true if the two keys contain the same set of indices and neither are `undefined`.
 */
export function equalsNotUndefined(
  key1: Partial<PathNode> | undefined,
  key2: Partial<PathNode> | undefined,
): boolean {
  if (key1 === undefined || key2 === undefined) {
    return false;
  }
  return (
    key1.resultIndex === key2.resultIndex &&
    key1.pathIndex === key2.pathIndex &&
    key1.pathNodeIndex === key2.pathNodeIndex
  );
}

/**
 * Returns the list of paths in the given SARIF result.
 *
 * Path nodes indices are relative to this flattened list.
 */
export function getAllPaths(result: SarifResult): ThreadFlow[] {
  if (result.codeFlows === undefined) {
    return [];
  }
  const paths = [];
  for (const codeFlow of result.codeFlows) {
    for (const threadFlow of codeFlow.threadFlows) {
      paths.push(threadFlow);
    }
  }
  return paths;
}

/**
 * Creates a unique string representation of the given key, suitable for use
 * as the key in a map or set.
 */
export function keyToString(key: ResultKey) {
  return `${key.resultIndex}-${key.pathIndex ?? ""}-${key.pathNodeIndex ?? ""}`;
}
