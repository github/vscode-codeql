import * as sarif from "sarif";

/**
 * Compare the alerts of two queries. Use deep equality to determine if
 * results have been added or removed across two invocations of a query.
 *
 * Assumptions:
 *
 * 1. Queries have the same sort order
 * 2. Results are not changed or re-ordered, they are only added or removed
 *
 * @param fromResults the source query
 * @param toResults the target query
 *
 * @throws Error when:
 *  1. If either query is empty
 *  2. If the queries are 100% disjoint
 */
export default function sarifDiff(
  fromResults: sarif.Result[],
  toResults: sarif.Result[],
) {
  if (!fromResults.length) {
    throw new Error("CodeQL Compare: Source query has no results.");
  }

  if (!toResults.length) {
    throw new Error("CodeQL Compare: Target query has no results.");
  }

  const results = {
    from: arrayDiff(fromResults, toResults),
    to: arrayDiff(toResults, fromResults),
  };

  if (
    fromResults.length === results.from.length &&
    toResults.length === results.to.length
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
