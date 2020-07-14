/**
 * TODO: Types in this file are deprecated, and uses of them should be
 * migrated to the analogous types in bqrs-cli-types.
 */

export enum LocationStyle {
  None = 0,
  String,
  FivePart,
  /** Does not occur in BQRS files. Used only to distinguish whole-file locations in client code. */
  WholeFile
}

/**
 * A primitive type (any type other than an element).
 */
export type PrimitiveTypeKind = 's' | 'b' | 'i' | 'f' | 'd' | 'u';

/**
 * A kind of type that a column may have.
 */
export type ColumnTypeKind = PrimitiveTypeKind | 'e';

/**
 * A column type that is a primitive type.
 */
export interface PrimitiveColumnType {
  type: PrimitiveTypeKind;
}

/**
 * A column type that is an element type.
 */
export interface ElementColumnType {
  type: 'e';
  primitiveType: PrimitiveTypeKind;
  locationStyle: LocationStyle;
  hasLabel: boolean;
}

/**
 * The type of a column.
 */
export type ColumnType = PrimitiveColumnType | ElementColumnType;

/**
 * The schema describing a single column in a `ResultSet`.
 */
export interface ColumnSchema {
  readonly name: string;
  readonly type: ColumnType;
}

/**
 * The schema of a single `ResultSet` in a BQRS file.
 */
export interface ResultSetSchema {
  readonly version: number;
  readonly name: string;
  readonly tupleCount: number;
  readonly columns: readonly ColumnSchema[];
}

/**
 * The schema describing the contents of a BQRS file.
 */
export interface ResultSetsSchema {
  readonly version: number;
  readonly stringPoolSize: number;
  readonly resultSets: readonly ResultSetSchema[];
}

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
