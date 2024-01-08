import type { Uri } from "vscode";

/**
 * The layout of the database.
 */
export enum DatabaseKind {
  /** A CodeQL database */
  Database,
  /** A raw QL dataset */
  RawDataset,
}

export interface DatabaseContents {
  /** The layout of the database */
  kind: DatabaseKind;
  /**
   * The name of the database.
   */
  name: string;
  /** The URI of the QL dataset within the database. */
  datasetUri: Uri;
  /** The URI of the source archive within the database, if one exists. */
  sourceArchiveUri?: Uri;
  /** The URI of the CodeQL database scheme within the database, if exactly one exists. */
  dbSchemeUri?: Uri;
}

export interface DatabaseContentsWithDbScheme extends DatabaseContents {
  dbSchemeUri: Uri; // Always present
}
