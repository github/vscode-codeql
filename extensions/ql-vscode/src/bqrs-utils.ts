import { StringLocation, LocationValue, LocationStyle, ResolvableLocationValue } from './bqrs-types';

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
  loc: LocationValue | undefined
): ResolvableLocationValue | undefined {
  let resolvedLoc;
  if (loc === undefined) {
    resolvedLoc = undefined;
  } else if (loc.t === LocationStyle.FivePart && loc.file) {
    resolvedLoc = loc;
  } else if (loc.t === LocationStyle.WholeFile && loc.file) {
    resolvedLoc = loc;
  } else if (loc.t === LocationStyle.String && loc.loc) {
    resolvedLoc = tryGetLocationFromString(loc);
  } else {
    resolvedLoc = undefined;
  }

  if (resolvedLoc && isEmptyPath(resolvedLoc.file)) {
    resolvedLoc = undefined;
  }

  return resolvedLoc;
}

export function tryGetLocationFromString(
  loc: StringLocation
): ResolvableLocationValue | undefined {
  const matches = FILE_LOCATION_REGEX.exec(loc.loc);
  if (matches && matches.length > 1 && matches[1]) {
    if (isWholeFileMatch(matches)) {
      return {
        t: LocationStyle.WholeFile,
        file: matches[1],
      };
    } else {
      return {
        t: LocationStyle.FivePart,
        file: matches[1],
        lineStart: Number(matches[2]),
        colStart: Number(matches[3]),
        lineEnd: Number(matches[4]),
        colEnd: Number(matches[5]),
      };
    }
  } else {
    return undefined;
  }
}

function isWholeFileMatch(matches: RegExpExecArray): boolean {
  return (
    matches[2] === '0' &&
    matches[3] === '0' &&
    matches[4] === '0' &&
    matches[5] === '0'
  );
}

/**
 * Checks whether the file path is empty. For now, just check whether
 * the file path is empty. If so, we do not want to render this location
 * as a link.
 *
 * @param path A file path
 */
function isEmptyPath(path: string) {
  return !path || path === '/';
}
