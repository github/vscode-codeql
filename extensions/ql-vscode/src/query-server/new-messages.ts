/**
 * Types for messages exchanged during jsonrpc communication with the
 * the CodeQL query server.
 *
 * This file exists in the queryserver and in the vscode extension, and
 * should be kept in sync between them.
 *
 * A note about the namespaces below, which look like they are
 * essentially enums, namely Severity, ResultColumnKind, and
 * QueryResultType. By design, for the sake of extensibility, clients
 * receiving messages of this protocol are supposed to accept any
 * number for any of these types. We commit to the given meaning of
 * the numbers listed in constants in the namespaces, and we commit to
 * the fact that any unknown QueryResultType value counts as an error.
 */

import { RequestType } from "vscode-jsonrpc";
import * as shared from "./messages-shared";

/**
 * Parameters to clear the cache
 */
export interface ClearCacheParams {
  /**
   * The dataset for which we want to clear the cache
   */
  db: string;
  /**
   * Whether the cache should actually be cleared.
   */
  dryRun: boolean;
  /**
   * The mode to use when trimming the disk cache.
   */
  mode?: CacheTrimmingMode;
}

export type CacheTrimmingMode = number;
/**
 * The mode to use when trimming the disk cache. This namespace is intentionally not an enum, see
 * "for the sake of extensibility" comment above.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CacheTrimmingMode {
  /** The entire cache is deleted unconditionally. */
  export const BRUTAL = 0;
  /** Only `cached` predicates are kept. */
  export const NORMAL = 1;
  /**
   * Trim the cache down to the configured size, but *within* this limit keep anything that
   * appears to be even possibly potentially useful in the future.
   */
  export const LIGHT = 2;
  /**
   * As {@link LIGHT}, but only if the *currently active* backend has written anything to
   * the cache in its lifetime. (Thus it doesn't make much sense to specify this in a stand-alone
   * CLI invocation, but we do it as a separate operation before shutting down a query server,
   * because it can then have its own timeout).
   */
  export const GENTLE = 3;
}

/**
 * Parameters for trimming the cache of a dataset
 */
export interface TrimCacheParams {
  /**
   * The dataset that we want to trim the cache of.
   */
  db: string;
}

/**
 * The result of trimming or clearing the cache.
 */
export interface ClearCacheResult {
  /**
   * A user friendly message saying what was or would be
   * deleted.
   */
  deletionMessage: string;
}

export type QueryResultType = number;
/**
 * The result of running a query. This namespace is intentionally not
 * an enum, see "for the sake of extensibility" comment above.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace QueryResultType {
  /**
   * The query ran successfully
   */
  export const SUCCESS = 0;
  /**
   * The query failed due to an reason
   * that isn't listed
   */
  export const OTHER_ERROR = 1;
  /**
   * The query failed do to compilation erorrs
   */
  export const COMPILATION_ERROR = 2;
  /**
   * The query failed due to running out of
   * memory
   */
  export const OOM = 3;
  /**
   * The query failed because it was cancelled.
   */
  export const CANCELLATION = 4;
  /**
   * The dbscheme basename was not the same
   */
  export const DBSCHEME_MISMATCH_NAME = 5;
  /**
   * No upgrade was found
   */
  export const DBSCHEME_NO_UPGRADE = 6;
}

export interface RegisterDatabasesParams {
  databases: string[];
}

export interface DeregisterDatabasesParams {
  databases: string[];
}

export type RegisterDatabasesResult = {
  registeredDatabases: string[];
};

export type DeregisterDatabasesResult = {
  registeredDatabases: string[];
};

export interface RunQueryParams {
  /**
   * The path of the query
   */
  queryPath: string;
  /**
   * The output path
   */
  outputPath: string;
  /**
   * The database path
   */
  db: string;
  additionalPacks: string[];
  target: CompilationTarget;
  externalInputs: Record<string, string>;
  singletonExternalInputs: Record<string, string>;
  dilPath?: string;
  logPath?: string;
  extensionPacks?: string[];
}

export interface RunQueryResult {
  resultType: QueryResultType;
  message?: string;
  expectedDbschemeName?: string;
  evaluationTime: number;
}

export interface UpgradeParams {
  db: string;
  additionalPacks: string[];
}

export type UpgradeResult = Record<string, unknown>;

export type ClearPackCacheParams = Record<string, unknown>;
export type ClearPackCacheResult = Record<string, unknown>;

/**
 * A position within a QL file.
 */
export type Position = shared.Position;

/**
 * The way of compiling the query, as a normal query
 * or a subset of it. Note that precisely one of the two options should be set.
 */
export type CompilationTarget = shared.CompilationTarget;

export type QuickEvalOptions = shared.QuickEvalOptions;

export type WithProgressId<T> = shared.WithProgressId<T>;
export type ProgressMessage = shared.ProgressMessage;

/**
 * Clear the cache of a dataset
 */
export const clearCache = new RequestType<
  WithProgressId<ClearCacheParams>,
  ClearCacheResult,
  void
>("evaluation/clearCache");
/**
 * Trim the cache of a dataset
 */
export const trimCache = new RequestType<
  WithProgressId<TrimCacheParams>,
  ClearCacheResult,
  void
>("evaluation/trimCache");

/**
 * Clear the pack cache
 */
export const clearPackCache = new RequestType<
  WithProgressId<ClearPackCacheParams>,
  ClearPackCacheResult,
  void
>("evaluation/clearPackCache");

/**
 * Run a query on a database
 */
export const runQuery = new RequestType<
  WithProgressId<RunQueryParams>,
  RunQueryResult,
  void
>("evaluation/runQuery");

export const registerDatabases = new RequestType<
  WithProgressId<RegisterDatabasesParams>,
  RegisterDatabasesResult,
  void
>("evaluation/registerDatabases");

export const deregisterDatabases = new RequestType<
  WithProgressId<DeregisterDatabasesParams>,
  DeregisterDatabasesResult,
  void
>("evaluation/deregisterDatabases");

export const upgradeDatabase = new RequestType<
  WithProgressId<UpgradeParams>,
  UpgradeResult,
  void
>("evaluation/runUpgrade");

/**
 * A notification that the progress has been changed.
 */
export const progress = shared.progress;
