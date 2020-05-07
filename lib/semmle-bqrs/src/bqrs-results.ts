import { LocationStyle } from "./bqrs-schema";

// See https://help.semmle.com/QL/learn-ql/ql/locations.html for how these are used.
export interface FivePartLocation {
  t: LocationStyle.FivePart;
  file: string;
  lineStart: number;
  colStart: number;
  lineEnd: number;
  colEnd: number;
}

export interface StringLocation {
  t: LocationStyle.String;
  loc: string;
}

/**
 * A location representing an entire filesystem resource.
 * This is usually derived from a `StringLocation` with the entire filesystem URL.
 */
export interface WholeFileLocation {
  t: LocationStyle.WholeFile;
  file: string;
}

export type RawLocationValue = FivePartLocation | StringLocation;

export type LocationValue = RawLocationValue | WholeFileLocation;

/** A location that may be resolved to a source code element. */
export type ResolvableLocationValue = FivePartLocation | WholeFileLocation;

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
  if (loc === undefined) {
    return undefined;
  } else if (loc.t === LocationStyle.FivePart && loc.file) {
    return loc;
  } else if (loc.t === LocationStyle.WholeFile && loc.file) {
    return loc;
  } else if (loc.t === LocationStyle.String && loc.loc) {
    return tryGetLocationFromString(loc);
  } else {
    return undefined;
  }
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
      }
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

export interface ElementBase {
  id: PrimitiveColumnValue;
  label?: string;
  location?: LocationValue;
}

export interface ElementWithLabel extends ElementBase {
  label: string;
}

export interface ElementWithLocation extends ElementBase {
  location: LocationValue;
}

export interface Element extends Required<ElementBase> {}

export type PrimitiveColumnValue = string | boolean | number | Date;
export type ColumnValue = PrimitiveColumnValue | ElementBase;
