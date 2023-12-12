/**
 * Types for messages exchanged during jsonrpc communication with the
 * the CodeQL query server.
 *
 * This file only contains types for messages that are still in use by
 * the extension. Communication with the query server happens through
 * messages in new-messages.ts.
 *
 * A note about the namespaces below, which look like they are
 * essentially enums, namely Severity and QueryResultType.
 * By design, for the sake of extensibility, clients
 * receiving messages of this protocol are supposed to accept any
 * number for any of these types. We commit to the given meaning of
 * the numbers listed in constants in the namespaces, and we commit to
 * the fact that any unknown QueryResultType value counts as an error.
 */

import * as shared from "./messages-shared";

/**
 * A compilation message (either an error or a warning)
 */
export interface CompilationMessage {
  /**
   * The text of the message
   */
  message: string;
  /**
   * The source position associated with the message
   */
  position: Position;
  /**
   * The severity of the message
   */
  severity: Severity;
}

export type Severity = number;
/**
 * Severity of different messages. This namespace is intentionally not
 * an enum, see "for the sake of extensibility" comment above.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Severity {
  /**
   * The message is a compilation error.
   */
  export const ERROR = 0;
  /**
   * The message is a compilation warning.
   */
  export const WARNING = 1;
}

/**
 * The result of a single query
 */
export interface EvaluationResult {
  /**
   * The id of the run that this query was in
   */
  runId: number;
  /**
   * The id of the query within the run
   */
  queryId: number;
  /**
   * The type of the result. See QueryResultType for
   * possible meanings. Any other result should be interpreted as an error.
   */
  resultType: QueryResultType;
  /**
   * The wall clock time it took to evaluate the query.
   * The time is from when we initially tried to evaluate the query
   * to when we get the results. Hence with parallel evaluation the times may
   * look odd.
   */
  evaluationTime: number;
  /**
   * An error message if an error happened
   */
  message?: string;

  /**
   * Full path to file with all log messages emitted while this query was active, if one exists
   */
  logFileLocation?: string;
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
   * The query failed due to running out of
   * memory
   */
  export const OOM = 2;
  /**
   * The query failed due to exceeding the timeout
   */
  export const TIMEOUT = 3;
  /**
   * The query failed because it was cancelled.
   */
  export const CANCELLATION = 4;
}

/**
 * A position within a QL file.
 */
export type Position = shared.Position;
