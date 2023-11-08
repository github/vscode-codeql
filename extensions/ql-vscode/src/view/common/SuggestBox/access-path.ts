// Avoid splitting by '.' since tokens may contain dots, e.g. `Field[foo.Bar.x]`.
// Instead use some simple parsing to match valid tokens.
// Based on https://github.com/github/codeql/blob/a04830b8b2d3e5f7df8e1f80f06c020b987a89a3/ruby/ql/lib/codeql/ruby/dataflow/internal/AccessPathSyntax.qll
// However, this does not use a regex to be more lenient in parsing (e.g. parsing partial access paths)

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
 * A token in an access path.
 */
type AccessPartToken = {
  text: string;
  range: AccessPathRange;
};

export function parseAccessPathTokens(path: string): AccessPartToken[] {
  const parts: AccessPartToken[] = [];

  let currentPart = "";
  let currentPathStart = 0;
  let bracketCounter = 0;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];

    if (c === "[") {
      bracketCounter++;
    } else if (c === "]") {
      bracketCounter--;
    } else if (c === "." && bracketCounter === 0) {
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

type AccessPathDiagnostic = {
  range: AccessPathRange;
  message: string;
};

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
