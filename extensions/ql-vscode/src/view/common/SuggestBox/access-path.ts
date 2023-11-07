// Based on https://github.com/github/codeql/blob/a04830b8b2d3e5f7df8e1f80f06c020b987a89a3/ruby/ql/lib/codeql/ruby/dataflow/internal/AccessPathSyntax.qll

// Avoid splitting by '.' since tokens may contain dots, e.g. `Field[foo.Bar.x]`.
// Instead use regexpFind to match valid tokens, and supplement with a final length
// check (in `AccessPath.hasSyntaxError`) to ensure all characters were included in a token.
const tokenRegex = /\w+(?:\[[^\]]*])?(?=\.|$)/;

export function parseAccessPathParts(path: string): string[] {
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(path))) {
    parts.push(match[0]);
    path = path.slice(match.index + match[0].length);
  }
  if (path.startsWith(".")) {
    parts.push(path.slice(1));
  }
  return parts;
}

export function hasAccessPathSyntaxError(path: string): boolean {
  if (path === "") {
    return false;
  }

  const parts = parseAccessPathParts(path);
  const totalExpectedLength =
    parts.reduce((sum, part) => sum + part.length + 1, 0) - 1;

  return totalExpectedLength !== path.length;
}
