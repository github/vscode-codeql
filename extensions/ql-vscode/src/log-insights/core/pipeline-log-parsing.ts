/**
 * Parsing for the pipeline log.
 */

const id = String.raw`[0-9a-zA-Z:#_\./]+`;
const idWithAngleBrackets = String.raw`[0-9a-zA-Z:#_<>\./]+`;
const quotedId = String.raw`\`[^\`\r\n]*\``;
const regexps = [
  // SCAN id
  String.raw`SCAN\s+(${id}|${quotedId})\s`,
  // JOIN id WITH id
  String.raw`JOIN\s+(${id}|${quotedId})\s+WITH\s+(${id}|${quotedId})\s`,
  // JOIN WITH id
  String.raw`JOIN\s+WITH\s+(${id}|${quotedId})\s`,
  // AGGREGATE id, id
  String.raw`AGGREGATE\s+(${id}|${quotedId})\s*,\s+(${id}|${quotedId})`,
  // id AND NOT id
  String.raw`(${id}|${quotedId})\s+AND\s+NOT\s+(${id}|${quotedId})`,
  // AND NOT id
  String.raw`AND\s+NOT\s+(${id}|${quotedId})`,
  // INVOKE HIGHER-ORDER RELATION rel ON <id, ..., id>
  String.raw`INVOKE\s+HIGHER-ORDER\s+RELATION\s[^\s]+\sON\s+<(${idWithAngleBrackets}|${quotedId})((?:,${idWithAngleBrackets}|,${quotedId})*)>`,
  // SELECT id
  String.raw`SELECT\s+(${id}|${quotedId})`,
  // REWRITE id WITH
  String.raw`REWRITE\s+(${id}|${quotedId})\s+WITH\s`,
  // id UNION id UNION ... UNION id
  String.raw`(${id}|${quotedId})((?:\s+UNION\s+${id}|${quotedId})+)`,
];

const unmaterializedRelationOrPrimitive = /r[0-9]+|PRIMITIVE/;

/**
 * The pattern matches a single line of RA such as:
 * ```
 * {2} r20 = SCAN functions OUTPUT In.0, In.1
 * ```
 * where:
 * - `\{[0-9]+\}\s`+ handles the `{2}` part
 * - `(?:[0-9a-zA-Z]+\s=|\|)\s` handles the `r20 =` part
 * - `regexps.join("|")` handles all the possible RA operations (such as the `SCAN`)
 */
const RAOperationPattern = new RegExp(
  `${String.raw`\{[0-9]+\}\s+(?:[0-9a-zA-Z]+\s=|\|)\s(?:` + regexps.join("|")})`,
);
/**
 * Gets the names of the predicates that a given operation depends on.
 *
 * For example, we want to know that this `JOIN` depends on `files` and `File::Impl::File.getURL/0#dispred#2f739b0d`:
 * ```
 * r4 = JOIN files WITH `File::Impl::File.getURL/0#dispred#2f739b0d` ON FIRST 1 OUTPUT _, Lhs.0, Rhs.1
 * ```
 * but we don't care about the r3 in:
 * ```
 * JOIN r3 WITH `DataFlowImpl::Impl<NonConstantFormat::NonConstFlow::C>::PathNode.toString/0#dispred#1c8954d0` ON FIRST 1 OUTPUT Lhs.2, Lhs.1, Lhs.0, Lhs.3, Rhs.1
 * ```
 * nor do we care about the dependency on range#bbb in:
 * ```
 * JOIN WITH PRIMITIVE range#bbb ON Lhs.4,Lhs.1,Lhs.3
 * ```
 */
export function getDependentPredicates(operations: string[]): string[] {
  return operations.flatMap((operation) => {
    const matches = RAOperationPattern.exec(operation.trim()) || [];
    return matches
      .slice(1) // Skip the first group as it's just the entire string
      .filter((x) => !!x)
      .flatMap((x) => x.split(",")) // Group 2 in the INVOKE HIGHER_ORDER RELATION case is a comma-separated list of identifiers.
      .flatMap((x) => x.split(" UNION ")) // Split n-ary unions into individual arguments.
      .filter((x) => !x.match(unmaterializedRelationOrPrimitive)) // Only keep the references to predicates.
      .filter((x) => !!x) // Remove empty strings
      .map((x) =>
        x.startsWith("`") && x.endsWith("`") ? x.substring(1, x.length - 1) : x,
      ); // Remove quotes from quoted identifiers
  });
}

export function isUnion(op: string): boolean {
  return op.includes(" UNION ");
}
