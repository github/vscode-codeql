import { LocationStyle } from './bqrs-schema';

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
const WHOLE_FILE_LOCATION_REGEX = /file:\/\/(.+):0:0:0:0/;

/**
 * Gets a resolvable source file location for the specified `LocationValue`, if possible.
 * @param loc The location to test.
 */
export function tryGetResolvableLocation(loc: LocationValue | undefined): ResolvableLocationValue | undefined {
  if (loc === undefined) {
    return undefined;
  }
  else if ((loc.t === LocationStyle.FivePart) && loc.file) {
    return loc;
  }
  else if ((loc.t === LocationStyle.WholeFile) && loc.file) {
    return loc;
  }
  else if ((loc.t === LocationStyle.String) && loc.loc) {
    return tryGetWholeFileLocation(loc);
  }
  else {
    return undefined;
  }
}

export function tryGetWholeFileLocation(loc: StringLocation): WholeFileLocation | undefined {
  const matches = WHOLE_FILE_LOCATION_REGEX.exec(loc.loc);
  if (matches && matches.length > 1 && matches[1]) {
    // Whole-file location.
    // We could represent this as a FivePartLocation with all numeric fields set to zero,
    // but that would be a deliberate misuse as those fields are intended to be 1-based.
    return {
      t: LocationStyle.WholeFile,
      file: matches[1]
    };
  } else {
    return undefined;
  }
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

export interface Element extends Required<ElementBase> {
}

export type PrimitiveColumnValue = string | boolean | number | Date;
export type ColumnValue = PrimitiveColumnValue | ElementBase;
