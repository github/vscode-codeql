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
// eslint-disable-next-line import/no-namespace -- these names are intentionally the same
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
interface ClearCacheResult {
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

interface RegisterDatabasesParams {
  databases: string[];
}

interface DeregisterDatabasesParams {
  databases: string[];
}

type RegisterDatabasesResult = {
  registeredDatabases: string[];
};

type DeregisterDatabasesResult = {
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

interface RunQueryResult {
  resultType: QueryResultType;
  message?: string;
  expectedDbschemeName?: string;
  evaluationTime: number;
}

interface UpgradeParams {
  db: string;
  additionalPacks: string[];
}

type UpgradeResult = Record<string, unknown>;

type ClearPackCacheParams = Record<string, unknown>;
type ClearPackCacheResult = Record<string, unknown>;

/**
 * A position within a QL file.
 */
export type Position = shared.Position;

/**
 * The way of compiling the query, as a normal query
 * or a subset of it. Note that precisely one of the two options should be set.
 */
type CompilationTarget = shared.CompilationTarget;

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
