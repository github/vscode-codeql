import { createRemoteFileRef } from "../common/location-link-utils";
import type { UrlValue } from "./raw-result-types";
import { isUrlValueResolvable } from "./raw-result-types";

/**
 * Checks whether the file path is empty. If so, we do not want to render this location
 * as a link.
 */
export function isEmptyPath(uriStr: string) {
  return !uriStr || uriStr === "file:/";
}

export function tryGetRemoteLocation(
  loc: UrlValue | undefined,
  fileLinkPrefix: string,
  sourceLocationPrefix: string | undefined,
): string | undefined {
  if (!loc || !isUrlValueResolvable(loc)) {
    return undefined;
  }

  let trimmedLocation: string;

  // Remote locations have the following format:
  // "file:${sourceLocationPrefix}/relative/path/to/file"
  // So we need to strip off the first part to get the relative path.
  if (sourceLocationPrefix) {
    if (!loc.uri.startsWith(`file:${sourceLocationPrefix}/`)) {
      return undefined;
    }
    trimmedLocation = loc.uri.replace(`file:${sourceLocationPrefix}/`, "");
  } else {
    // If the source location prefix is empty (e.g. for older remote queries), we assume that the database
    // was created on a Linux actions runner and has the format:
    // "file:/home/runner/work/<repo>/<repo>/relative/path/to/file"
    // So we need to drop the first 6 parts of the path.
    if (!loc.uri.startsWith("file:/home/runner/work/")) {
      return undefined;
    }
    const locationParts = loc.uri.split("/");
    trimmedLocation = locationParts.slice(6, locationParts.length).join("/");
  }

  const fileLink = {
    fileLinkPrefix,
    filePath: trimmedLocation,
  };

  if (loc.type === "wholeFileLocation") {
    return createRemoteFileRef(fileLink);
  }

  return createRemoteFileRef(
    fileLink,
    loc.startLine,
    loc.endLine,
    loc.startColumn,
    loc.endColumn,
  );
}
