// Avoid splitting by '.' since tokens may contain dots, e.g. `Field[foo.Bar.x]`.
// Instead use some simple parsing to match valid tokens.
// Based on https://github.com/github/codeql/blob/a04830b8b2d3e5f7df8e1f80f06c020b987a89a3/ruby/ql/lib/codeql/ruby/dataflow/internal/AccessPathSyntax.qll
// However, this does not use a regex to be more lenient in parsing (e.g. parsing partial access paths)

export function parseAccessPathParts(path: string): string[] {
  const parts: string[] = [];

  let currentPart = "";
  let inPath = false;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];

    if (c === "[") {
      inPath = true;
    } else if (c === "]") {
      inPath = false;
    } else if (c === "." && !inPath) {
      parts.push(currentPart);
      currentPart = "";
      continue;
    }

    currentPart += c;
  }

  parts.push(currentPart);

  return parts;
}

// Regex for a single part of the access path
const tokenRegex = /^(\w+)(?:\[([^\]]*)])?$/;

export function hasAccessPathSyntaxError(path: string): boolean {
  if (path === "") {
    return false;
  }

  const parts = parseAccessPathParts(path);
  const totalExpectedLength =
    parts.reduce((sum, part) => sum + part.length + 1, 0) - 1;

  if (totalExpectedLength !== path.length) {
    return false;
  }

  return parts.some((part) => !tokenRegex.test(part));
}
