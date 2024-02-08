/**
 * helpers-pure.ts
 * ------------
 *
 * Helper functions that don't depend on vscode or the CLI and therefore can be used by the front-end and pure unit tests.
 */

import { RedactableError } from "./errors";

// Matches any type that is not an array. This is useful to help avoid
// nested arrays, or for cases like createSingleSelectionCommand to avoid T
// accidentally getting instantiated as DatabaseItem[] instead of DatabaseItem.
export type NotArray =
  | string
  | bigint
  | number
  | boolean
  | (object & {
      length?: never;
    });

/**
 * This error is used to indicate a runtime failure of an exhaustivity check enforced at compile time.
 */
class ExhaustivityCheckingError extends Error {
  constructor(public expectedExhaustiveValue: never) {
    super("Internal error: exhaustivity checking failure");
  }
}

/**
 * Used to perform compile-time exhaustivity checking on a value.  This function will not be executed at runtime unless
 * the type system has been subverted.
 */
export function assertNever(value: never): never {
  throw new ExhaustivityCheckingError(value);
}

/**
 * Use to perform array filters where the predicate is asynchronous.
 */
export async function asyncFilter<T>(
  arr: T[],
  predicate: (arg0: T) => Promise<boolean>,
) {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_, index) => results[index]);
}

/**
 * This regex matches strings of the form `owner/repo` where:
 * - `owner` is made up of alphanumeric characters, hyphens, underscores, or periods
 * - `repo` is made up of alphanumeric characters, hyphens, underscores, or periods
 */
export const REPO_REGEX = /^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/;

/**
 * This regex matches GiHub organization and user strings. These are made up for alphanumeric
 * characters, hyphens, underscores or periods.
 */
export const OWNER_REGEX = /^[a-zA-Z0-9-_.]+$/;

export function getErrorMessage(e: unknown): string {
  if (e instanceof RedactableError) {
    return e.fullMessage;
  }

  return e instanceof Error ? e.message : String(e);
}

export function getErrorStack(e: unknown): string {
  return e instanceof Error ? e.stack ?? "" : "";
}

export function asError(e: unknown): Error {
  if (e instanceof RedactableError) {
    return new Error(e.fullMessage);
  }

  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Get error message when the error may have come from a method from the `child_process` module.
 */
export function getChildProcessErrorMessage(e: unknown): string {
  return isChildProcessError(e) ? e.stderr : getErrorMessage(e);
}

/**
 * Error thrown from methods from the `child_process` module.
 */
interface ChildProcessError {
  readonly stderr: string;
}

function isChildProcessError(e: unknown): e is ChildProcessError {
  return (
    typeof e === "object" &&
    e !== null &&
    "stderr" in e &&
    typeof e.stderr === "string"
  );
}
