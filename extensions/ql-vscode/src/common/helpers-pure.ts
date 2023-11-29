/**
 * helpers-pure.ts
 * ------------
 *
 * Helper functions that don't depend on vscode or the CLI and therefore can be used by the front-end and pure unit tests.
 */

import { DataRow } from "../model-editor/model-extension-file";
import { RedactableError } from "./errors";

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

/*
  private int djb2_part(string s, int i) {
    djb2_input(s) and i = 0 and result = 5381
    or
    (djb2_part(s, i - 1) * 33).bitXor(s.codePointAt(i - 1)) = result
  }
  
  private int djb2(string s) {
    // Bernstein hash (XOR version)
    // seed = 5381
    // hash(i) = hash(i - 1) * 33 ^ str[i]
    result = djb2_part(s, s.length())
  }*/

export function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return hash;
}

/*+  exists(int h1, int h2, int h3, int h4, int h5, int h6, int h7, int h8, int h9, int h10, int p |
+    p = 19 and
+    madid =
+      ((((((((h1 * p + h2) * p + h3) * p + h4) * p + h5) * p + h6) * p + h7) * p + h8) * p + h9) * p
+        + h10 and
+    h1 = djb2(package) and
+    h2 = djb2(type) and
+    (
+      subtypes = true and h3 = 1
+      or
+      subtypes = false and h3 = 0
+    ) and
+    h4 = djb2(name) and
+    h5 = djb2(signature) and
+    h6 = djb2(ext) and
+    h7 = djb2(input) and
+    h8 = djb2(output) and
+    h9 = djb2(kind) and
+    h10 = djb2(provenance)
*/

export function hashMad(row: DataRow): string {
  const p = 19;
  let madid = 0;
  for (const tuple of row) {
    if (typeof tuple === "string") {
      madid = madid * p + djb2(tuple);
    } else if (typeof tuple === "number") {
      madid = madid * p + tuple;
    } else if (typeof tuple === "boolean") {
      madid = madid * p + (tuple ? 1 : 0);
    }
    // We need to overflow the number to a 32-bit integer
    madid = madid | 0;
  }

  return madid.toString();
}
