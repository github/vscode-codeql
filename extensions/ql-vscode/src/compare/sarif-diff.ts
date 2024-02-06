import type { Result } from "sarif";

function toCanonicalResult(result: Result): Result {
  const canonicalResult = {
    ...result,
  };

  if (canonicalResult.locations) {
    canonicalResult.locations = canonicalResult.locations.map((location) => {
      if (location.physicalLocation?.artifactLocation?.index !== undefined) {
        const canonicalLocation = {
          ...location,
        };

        canonicalLocation.physicalLocation = {
          ...canonicalLocation.physicalLocation,
        };

        canonicalLocation.physicalLocation.artifactLocation = {
          ...canonicalLocation.physicalLocation.artifactLocation,
        };

        // The index is dependent on the result of the SARIF file and usually doesn't really tell
        // us anything useful, so we remove it from the comparison.
        delete canonicalLocation.physicalLocation.artifactLocation.index;

        return canonicalLocation;
      }

      // Don't create a new object if we don't need to
      return location;
    });
  }

  return canonicalResult;
}

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
export function sarifDiff(fromResults: Result[], toResults: Result[]) {
  if (!fromResults.length) {
    throw new Error("CodeQL Compare: Source query has no results.");
  }

  if (!toResults.length) {
    throw new Error("CodeQL Compare: Target query has no results.");
  }

  const canonicalFromResults = fromResults.map(toCanonicalResult);
  const canonicalToResults = toResults.map(toCanonicalResult);

  const results = {
    from: arrayDiff(canonicalFromResults, canonicalToResults),
    to: arrayDiff(canonicalToResults, canonicalFromResults),
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
