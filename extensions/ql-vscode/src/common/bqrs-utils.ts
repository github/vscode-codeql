import { createRemoteFileRef } from "../common/location-link-utils";
import {
  isUrlValueResolvable,
  UrlValue,
  UrlValueResolvable,
} from "./raw-result-types";
import {
  LineColumnLocation,
  UrlValue as BqrsUrlValue,
  WholeFileLocation,
} from "./bqrs-cli-types";

/**
 * Checks whether the file path is empty. If so, we do not want to render this location
 * as a link.
 */
export function isEmptyPath(uriStr: string) {
  return !uriStr || uriStr === "file:/";
}

/**
 * The CodeQL filesystem libraries use this pattern in `getURL()` predicates
 * to describe the location of an entire filesystem resource.
 * Such locations appear as `StringLocation`s instead of `FivePartLocation`s.
 *
 * Folder resources also get similar URLs, but with the `folder` scheme.
 * They are deliberately ignored here, since there is no suitable location to show the user.
 */
const FILE_LOCATION_REGEX = /file:\/\/(.+):([0-9]+):([0-9]+):([0-9]+):([0-9]+)/;
/**
 * Gets a resolvable source file location for the specified `LocationValue`, if possible.
 * @param loc The location to test.
 */
export function tryGetResolvableLocation(
  loc: BqrsUrlValue | undefined,
): UrlValueResolvable | undefined {
  let resolvedLoc: UrlValueResolvable | undefined;
  if (loc === undefined) {
    resolvedLoc = undefined;
  } else if (isWholeFileLoc(loc)) {
    resolvedLoc = {
      type: "wholeFileLocation",
      uri: loc.uri,
    };
  } else if (isLineColumnLoc(loc)) {
    resolvedLoc = {
      type: "lineColumnLocation",
      uri: loc.uri,
      startLine: loc.startLine,
      startColumn: loc.startColumn,
      endLine: loc.endLine,
      endColumn: loc.endColumn,
    };
  } else if (isStringLoc(loc)) {
    resolvedLoc = tryGetLocationFromString(loc);
  } else {
    resolvedLoc = undefined;
  }

  return resolvedLoc;
}

export function tryGetLocationFromString(
  loc: string,
): UrlValueResolvable | undefined {
  const matches = FILE_LOCATION_REGEX.exec(loc);
  if (matches && matches.length > 1 && matches[1]) {
    if (isWholeFileMatch(matches)) {
      return {
        type: "wholeFileLocation",
        uri: matches[1],
      };
    } else {
      return {
        type: "lineColumnLocation",
        uri: matches[1],
        startLine: Number(matches[2]),
        startColumn: Number(matches[3]),
        endLine: Number(matches[4]),
        endColumn: Number(matches[5]),
      };
    }
  } else {
    return undefined;
  }
}

function isWholeFileMatch(matches: RegExpExecArray): boolean {
  return (
    matches[2] === "0" &&
    matches[3] === "0" &&
    matches[4] === "0" &&
    matches[5] === "0"
  );
}

export function isLineColumnLoc(loc: BqrsUrlValue): loc is LineColumnLocation {
  return (
    typeof loc !== "string" &&
    !isEmptyPath(loc.uri) &&
    "startLine" in loc &&
    "startColumn" in loc &&
    "endLine" in loc &&
    "endColumn" in loc
  );
}

export function isWholeFileLoc(loc: BqrsUrlValue): loc is WholeFileLocation {
  return (
    typeof loc !== "string" && !isEmptyPath(loc.uri) && !isLineColumnLoc(loc)
  );
}

export function isStringLoc(loc: BqrsUrlValue): loc is string {
  return typeof loc === "string";
}

export function tryGetBqrsRemoteLocation(
  loc: BqrsUrlValue | undefined,
  fileLinkPrefix: string,
  sourceLocationPrefix: string | undefined,
): string | undefined {
  const resolvedLoc = tryGetResolvableLocation(loc);

  return tryGetRemoteLocation(
    resolvedLoc,
    fileLinkPrefix,
    sourceLocationPrefix,
  );
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
