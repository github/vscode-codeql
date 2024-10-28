import type { Location, Result, ThreadFlowLocation } from "sarif";

function toCanonicalLocation(location: Location): Location {
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
}

function toCanonicalThreadFlowLocation(
  threadFlowLocation: ThreadFlowLocation,
): ThreadFlowLocation {
  if (threadFlowLocation.location) {
    return {
      ...threadFlowLocation,
      location: toCanonicalLocation(threadFlowLocation.location),
    };
  }

  return threadFlowLocation;
}

function toCanonicalResult(result: Result): Result {
  const canonicalResult = {
    ...result,
  };

  if (canonicalResult.locations) {
    canonicalResult.locations =
      canonicalResult.locations.map(toCanonicalLocation);
  }

  if (canonicalResult.relatedLocations) {
    canonicalResult.relatedLocations =
      canonicalResult.relatedLocations.map(toCanonicalLocation);
  }

  if (canonicalResult.codeFlows && canonicalResult.codeFlows.length > 0) {
    // If there are codeFlows, we don't want to compare the full codeFlows. Instead, we just want to compare the
    // source and the sink (i.e. the first and last item). CodeQL should guarantee that the first and last threadFlow
    // of every codeFlow is the same (i.e. every codeFlow has the same source and sink). Therefore, we just compare the
    // first codeFlow and ignore the other codeFlows completely.
    // If the codeFlow has a length of 1, this doesn't change the result.

    const source = {
      ...canonicalResult.codeFlows[0].threadFlows[0],
    };
    const sink = {
      ...canonicalResult.codeFlows[0].threadFlows[
        canonicalResult.codeFlows[0].threadFlows.length - 1
      ],
    };
    source.locations = source.locations.map(toCanonicalThreadFlowLocation);
    sink.locations = sink.locations.map(toCanonicalThreadFlowLocation);

    canonicalResult.codeFlows = [
      {
        ...canonicalResult.codeFlows[0],
        threadFlows: [source, sink],
      },
    ];
  }

  return canonicalResult;
}

/**
 * Compare the alerts of two queries. Use deep equality to determine if
 * results have been added or removed across two invocations of a query.
 * It first canonicalizes the results to ensure that when small changes
 * to the query are made, the results are still considered the same. This
 * includes the removal of all paths except for the source and sink.
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

  const diffResults = {
    from: arrayDiff(canonicalFromResults, canonicalToResults),
    to: arrayDiff(canonicalToResults, canonicalFromResults),
  };

  if (
    fromResults.length === diffResults.from.length &&
    toResults.length === diffResults.to.length
  ) {
    throw new Error("CodeQL Compare: No overlap between the selected queries.");
  }

  // We don't want to return the canonical results, we want to return the original results.
  // We can retrieve this by finding the index of the canonical result in the canonical results
  // and then using that index to find the original result. This is possible because we know that
  // we did a 1-to-1 map between the canonical results and the original results.
  return {
    from: diffResults.from.map(
      (result) => fromResults[canonicalFromResults.indexOf(result)],
    ),
    to: diffResults.to.map(
      (result) => toResults[canonicalToResults.indexOf(result)],
    ),
  };
}

function arrayDiff<T>(source: readonly T[], toRemove: readonly T[]): T[] {
  // Stringify the object so that we can compare hashes in the set
  const rest = new Set(toRemove.map((item) => JSON.stringify(item)));
  return source.filter((element) => !rest.has(JSON.stringify(element)));
}
