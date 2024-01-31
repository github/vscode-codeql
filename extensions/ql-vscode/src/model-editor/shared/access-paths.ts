/**
 * This file contains functions for parsing and validating access paths.
 *
 * This intentionally does not simply split by '.' since tokens may contain dots,
 * e.g. `Field[foo.Bar.x]`. Instead, it uses some simple parsing to match valid tokens.
 *
 * Valid syntax was determined based on this file:
 * https://github.com/github/codeql/blob/a04830b8b2d3e5f7df8e1f80f06c020b987a89a3/ruby/ql/lib/codeql/ruby/dataflow/internal/AccessPathSyntax.qll
 *
 * In contrast to that file, we do not use a regex for parsing to allow us to be more lenient.
 * For example, we can parse partial access paths such as `Field[foo.Bar.x` without error.
 */

/**
 * A range of characters in an access path. The start position is inclusive, the end position is exclusive.
 */
type AccessPathRange = {
  /**
   * Zero-based index of the first character of the token.
   */
  start: number;
  /**
   * Zero-based index of the character after the last character of the token.
   */
  end: number;
};

/**
 * A token in an access path. For example, `Argument[foo]` is a token.
 */
type AccessPartToken = {
  text: string;
  range: AccessPathRange;
};

/**
 * Parses an access path into tokens.
 *
 * @param path The access path to parse.
 * @returns An array of tokens.
 */
export function parseAccessPathTokens(path: string): AccessPartToken[] {
  const parts: AccessPartToken[] = [];

  let currentPart = "";
  let currentPathStart = 0;
  // Keep track of the number of brackets we can parse the path correctly when it contains
  // nested brackets such as `Argument[foo[bar].test].Element`.
  let bracketCounter = 0;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];

    if (c === "[") {
      bracketCounter++;
    } else if (c === "]") {
      bracketCounter--;
    } else if (c === "." && bracketCounter === 0) {
      // A part ends when we encounter a dot that is not inside brackets.
      parts.push({
        text: currentPart,
        range: {
          start: currentPathStart,
          end: i,
        },
      });
      currentPart = "";
      currentPathStart = i + 1;
      continue;
    }

    currentPart += c;
  }

  // The last part should not be followed by a dot, so we need to add it manually.
  // If the path is empty, such as for `Argument[foo].`, then this is still correct
  // since the `validateAccessPath` function will check that none of the tokens are
  // empty.
  parts.push({
    text: currentPart,
    range: {
      start: currentPathStart,
      end: path.length,
    },
  });

  return parts;
}

// Regex for a single part of the access path
const tokenRegex = /^(\w+)(?:\[([^\]]*)])?$/;

export type AccessPathDiagnostic = {
  range: AccessPathRange;
  message: string;
};

/**
 * Validates an access path and returns any errors. This requires that the path is a valid path
 * and does not allow partial access paths.
 *
 * @param path The access path to validate.
 * @returns An array of diagnostics for any errors in the access path.
 */
export function validateAccessPath(path: string): AccessPathDiagnostic[] {
  if (path === "") {
    return [];
  }

  const tokens = parseAccessPathTokens(path);

  return tokens
    .map((token): AccessPathDiagnostic | null => {
      if (tokenRegex.test(token.text)) {
        return null;
      }

      let message = "Invalid access path";
      if (token.range.start === token.range.end) {
        message = "Unexpected empty token";
      }

      return {
        range: token.range,
        message,
      };
    })
    .filter((token): token is AccessPathDiagnostic => token !== null);
}
