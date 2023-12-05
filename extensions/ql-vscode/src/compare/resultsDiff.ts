import { DecodedBqrsChunk } from "../common/bqrs-cli-types";
import { RawQueryCompareResult } from "../common/interface-types";

/**
 * Compare the rows of two queries. Use deep equality to determine if
 * rows have been added or removed across two invocations of a query.
 *
 * Assumptions:
 *
 * 1. Queries have the same sort order
 * 2. Queries have same number and order of columns
 * 3. Rows are not changed or re-ordered, they are only added or removed
 *
 * @param fromResults the source query
 * @param toResults the target query
 *
 * @throws Error when:
 *  1. number of columns do not match
 *  2. If either query is empty
 *  3. If the queries are 100% disjoint
 */
export default function resultsDiff(
  fromResults: DecodedBqrsChunk,
  toResults: DecodedBqrsChunk,
): RawQueryCompareResult {
  if (fromResults.columns.length !== toResults.columns.length) {
    throw new Error("CodeQL Compare: Columns do not match.");
  }

  if (!fromResults.tuples.length) {
    throw new Error("CodeQL Compare: Source query has no results.");
  }

  if (!toResults.tuples.length) {
    throw new Error("CodeQL Compare: Target query has no results.");
  }

  const results = {
    columns: fromResults.columns,
    from: arrayDiff(fromResults.tuples, toResults.tuples),
    to: arrayDiff(toResults.tuples, fromResults.tuples),
  };

  if (
    fromResults.tuples.length === results.from.length &&
    toResults.tuples.length === results.to.length
  ) {
    throw new Error("CodeQL Compare: No overlap between the selected queries.");
  }

  return results;
}

function arrayDiff<T>(source: readonly T[], toRemove: readonly T[]): T[] {
  // Stringify the object so that we can compare hashes in the set
  const rest = new Set(toRemove.map((item) => JSON.stringify(item)));
  return source.filter((element) => !rest.has(JSON.stringify(element)));
}
