import * as fs from "fs";

export interface Position {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  url: string;
}
export interface PerformanceLogEntryDependency {
  predicateName: string;
  raHash: string;
}
export interface PerformanceLogEntry {
  raHash: string;
  completionTime: string;
  position: Position;
  evaluationStrategy: string;
  dependencies: PerformanceLogEntryDependency[];
  millis: number;
  predicateName: string;
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
 * Because some dependencies may be missing in the filtered log, we need to prune them. This
 * function will prune out orphaned dependencies.
 * @param entries The entries to filter.
 * @param raDatabase An index of all rows.
 */
export function pruneMissingDependencies(
  entries: PerformanceLogEntry[],
  raDatabase: Map<string, PerformanceLogEntry>,
) {
  entries.forEach((e) => {
    e.dependencies = e.dependencies.filter((d) => raDatabase.has(d.raHash));
  });
}

/**
 * Creates a lookup index for a set of PerformanceLogEntry objects.
 * @param entries The PerformanceLogEntry objects to index.
 * @returns a map of PerformanceLogEntry objects to their index.
 */
export function indexPerformanceLogEntries(
  entries: PerformanceLogEntry[],
): Map<string, PerformanceLogEntry> {
  const idx = new Map<string, PerformanceLogEntry>();

  for (const row of entries) {
    if (!idx.has(row.raHash)) {
      idx.set(row.raHash, row);
    }
  }

  return idx;
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
 * Converts a JSON log row into a PerformanceLogEntry object.
 * @param row A JSON log row.
 * @returns
 */
export function jsonLogRowToPerformanceLogEntry(row: any): PerformanceLogEntry {
  const entry: PerformanceLogEntry = {
    raHash: row.raHash,
    completionTime: row.completionTime,
    position: decodePositionFromString(row.position),
    evaluationStrategy: row.evaluationStrategy,
    millis: row.millis,
    predicateName: row.predicateName,
    dependencies: [],
  };

  if (row.dependencies) {
    for (const k in row.dependencies) {
      entry.dependencies.push({
        predicateName: k,
        raHash: row.dependencies[k],
      });
    }
  }

  return entry;
}

/**
 * Converts a JSON log to an array of PerformanceLogEntry objects.
 * @param log The JSON log to convert.
 * @returns An array of PerformanceLogEntry objects.
 */
export function jsonLogToPerformanceLogEntries(
  log: any[],
): PerformanceLogEntry[] {
  const logEntries: PerformanceLogEntry[] = [];

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

    const performanceLogEntry = jsonLogRowToPerformanceLogEntry(row);

    logEntries.push(performanceLogEntry);
  }

  return logEntries;
}
