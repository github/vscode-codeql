/**
 * helpers-pure.ts
 * ------------
 *
 * Helper functions that don't depend on vscode or the CLI and therefore can be used by the front-end and pure unit tests.
 */

import { RedactableError } from "../common/errors";

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
export const asyncFilter = async function <T>(
  arr: T[],
  predicate: (arg0: T) => Promise<boolean>,
) {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_, index) => results[index]);
};

/**
 * This regex matches strings of the form `owner/repo` where:
 * - `owner` is made up of alphanumeric characters, hyphens, underscores, or periods
 * - `repo` is made up of alphanumeric characters, hyphens, underscores, or periods
 */
export const REPO_REGEX = /^[a-zA-Z0-9-_\.]+\/[a-zA-Z0-9-_\.]+$/;

/**
 * This regex matches GiHub organization and user strings. These are made up for alphanumeric
 * characters, hyphens, underscores or periods.
 */
export const OWNER_REGEX = /^[a-zA-Z0-9-_\.]+$/;

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
