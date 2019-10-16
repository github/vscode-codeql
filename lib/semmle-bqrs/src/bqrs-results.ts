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

export type LocationValue = FivePartLocation | StringLocation;

/**
 * Determines whether the specified `LocationValue` can be resolved to an actual source file.
 * @param loc The location to test.
 */
export function isResolvableLocation(loc: LocationValue | undefined): loc is FivePartLocation {
  if (loc && (loc.t === LocationStyle.FivePart) && loc.file) {
    return true;
  }
  else {
    return false;
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
