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

import { NotificationType } from "vscode-jsonrpc";

/**
 * A position within a QL file.
 */
export interface Position {
  /**
   * The one-based index of the start line
   */
  line: number;
  /**
   * The one-based offset of the start column within
   * the start line in UTF-16 code-units
   */
  column: number;
  /**
   * The one-based index of the end line line
   */
  endLine: number;

  /**
   * The one-based offset of the end column within
   * the end line in UTF-16 code-units
   */
  endColumn: number;
  /**
   * The path of the file.
   * If the file name is "Compiler Generated" the
   * the position is not a real position but
   * arises from compiler generated code.
   */
  fileName: string;
}

/**
 * The way of compiling the query, as a normal query
 * or a subset of it. Note that precisely one of the two options should be set.
 */
export interface CompilationTarget {
  /**
   * Compile as a normal query
   */
  query?: Record<string, never>;
  /**
   * Compile as a quick evaluation
   */
  quickEval?: QuickEvalOptions;
}

/**
 * Options for quick evaluation
 */
export interface QuickEvalOptions {
  quickEvalPos?: Position;
  /**
   * Whether to only count the number of results.
   */
  countOnly?: boolean;
}

/**
 * Type for any action that could have progress messages.
 */
export interface WithProgressId<T> {
  /**
   * The main body
   */
  body: T;
  /**
   * The id used to report progress updates
   */
  progressId: number;
}

export interface ProgressMessage {
  /**
   * The id of the operation that is running
   */
  id: number;
  /**
   * The current step
   */
  step: number;
  /**
   * The maximum step. This *should* be constant for a single job.
   */
  maxStep: number;
  /**
   * The current progress message
   */
  message: string;
}

/**
 * A notification that the progress has been changed.
 */
export const progress = new NotificationType<ProgressMessage>(
  "ql/progressUpdated",
);
