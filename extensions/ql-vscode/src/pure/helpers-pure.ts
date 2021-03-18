/**
 * helpers-pure.ts
 * ------------
 *
 * Helper functions that don't depend on vscode or the CLI and therefore can be used by the front-end and pure unit tests.
 */

/**
 * This error is used to indicate a runtime failure of an exhaustivity check enforced at compile time.
 */
class ExhaustivityCheckingError extends Error {
  constructor(public expectedExhaustiveValue: never) {
    super('Internal error: exhaustivity checking failure');
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
export const asyncFilter = async function <T>(arr: T[], predicate: (arg0: T) => Promise<boolean>) {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_, index) => results[index]);
};

/**
 * Creates a succint version of an error message, e.g. for displaying in a pop-up.
 * @param errorMessage The error message to shorten.
 * @return A shortened version of the error message.
 */
export function shortenErrorMessage(errorMessage: string): string {
  // Filter out lines corresponding to Java stack traces.
  const stackTraceLine = /\r?\n\s*(com|org|net)\..*\.java:[0-9]+\)(?=\r?\n)/g;
  let succintMessage = errorMessage.toString().replace(stackTraceLine, '');

  // Filter out lines corresponding to log lines.
  const logLine = /\r?\n\[[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]\].*/g;
  succintMessage = succintMessage.replace(logLine, '');

  // Trim indentation at the start of lines.
  const indentedLine = /(\r?\n)\s+/g;
  succintMessage = succintMessage.replace(indentedLine, '$1').trim();

  // Remove duplicated lines.
  const duplicatedLine = /(\r?\n.*)\1+/g;
  succintMessage = succintMessage.replace(duplicatedLine, '$1');

  return succintMessage;
}
