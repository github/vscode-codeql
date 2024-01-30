import { parseAccessPathTokens } from "./shared/access-paths";
import type { AccessPathOption, AccessPathSuggestionRow } from "./suggestions";
import { AccessPathSuggestionDefinitionType } from "./suggestions";

const CodiconSymbols: Record<AccessPathSuggestionDefinitionType, string> = {
  [AccessPathSuggestionDefinitionType.Array]: "symbol-array",
  [AccessPathSuggestionDefinitionType.Class]: "symbol-class",
  [AccessPathSuggestionDefinitionType.Enum]: "symbol-enum",
  [AccessPathSuggestionDefinitionType.EnumMember]: "symbol-enum-member",
  [AccessPathSuggestionDefinitionType.Field]: "symbol-field",
  [AccessPathSuggestionDefinitionType.Interface]: "symbol-interface",
  [AccessPathSuggestionDefinitionType.Key]: "symbol-key",
  [AccessPathSuggestionDefinitionType.Method]: "symbol-method",
  [AccessPathSuggestionDefinitionType.Misc]: "symbol-misc",
  [AccessPathSuggestionDefinitionType.Namespace]: "symbol-namespace",
  [AccessPathSuggestionDefinitionType.Parameter]: "symbol-parameter",
  [AccessPathSuggestionDefinitionType.Property]: "symbol-property",
  [AccessPathSuggestionDefinitionType.Structure]: "symbol-structure",
  [AccessPathSuggestionDefinitionType.Return]: "symbol-method",
  [AccessPathSuggestionDefinitionType.Variable]: "symbol-variable",
};

/**
 * Parses the query results from a parsed array of rows to a list of options per method signature.
 *
 * @param rows The parsed rows from the BQRS chunk
 * @return A map from method signature -> options
 */
export function parseAccessPathSuggestionRowsToOptions(
  rows: AccessPathSuggestionRow[],
): Record<string, AccessPathOption[]> {
  const rowsByMethodSignature = new Map<string, AccessPathSuggestionRow[]>();

  for (const row of rows) {
    if (!rowsByMethodSignature.has(row.method.signature)) {
      rowsByMethodSignature.set(row.method.signature, []);
    }

    const tuplesForMethodSignature = rowsByMethodSignature.get(
      row.method.signature,
    );
    if (!tuplesForMethodSignature) {
      throw new Error("Expected the map to have a value for method signature");
    }

    tuplesForMethodSignature.push(row);
  }

  const result: Record<string, AccessPathOption[]> = {};

  for (const [methodSignature, tuples] of rowsByMethodSignature) {
    result[methodSignature] = parseQueryResultsForPath(tuples);
  }

  return result;
}

function parseQueryResultsForPath(
  rows: AccessPathSuggestionRow[],
): AccessPathOption[] {
  const optionsByParentPath = new Map<string, AccessPathOption[]>();

  for (const { value, details, definitionType } of rows) {
    const tokens = parseAccessPathTokens(value);
    const lastToken = tokens[tokens.length - 1];

    const parentPath = tokens
      .slice(0, tokens.length - 1)
      .map((token) => token.text)
      .join(".");

    const option: AccessPathOption = {
      label: lastToken.text,
      value,
      details,
      icon: CodiconSymbols[definitionType],
      followup: [],
    };

    if (!optionsByParentPath.has(parentPath)) {
      optionsByParentPath.set(parentPath, []);
    }

    const options = optionsByParentPath.get(parentPath);
    if (!options) {
      throw new Error(
        "Expected optionsByParentPath to have a value for parentPath",
      );
    }

    options.push(option);
  }

  for (const options of optionsByParentPath.values()) {
    options.sort(compareOptions);
  }

  for (const options of optionsByParentPath.values()) {
    for (const option of options) {
      const followup = optionsByParentPath.get(option.value);
      if (followup) {
        option.followup = followup;
      }
    }
  }

  const rootOptions = optionsByParentPath.get("");
  if (!rootOptions) {
    throw new Error("Expected optionsByParentPath to have a value for ''");
  }

  return rootOptions;
}

/**
 * Compares two options based on a set of predefined rules.
 *
 * The rules are as follows:
 * - Argument[self] is always first
 * - Positional arguments (Argument[0], Argument[1], etc.) are sorted in order and are after Argument[self]
 * - Keyword arguments (Argument[key:], etc.) are sorted by name and are after the positional arguments
 * - Block arguments (Argument[block]) are sorted after keyword arguments
 * - Hash splat arguments (Argument[hash-splat]) are sorted after block arguments
 * - Parameters (Parameter[0], Parameter[1], etc.) are sorted after and in-order
 * - All other values are sorted alphabetically after parameters
 *
 * @param {Option} a - The first option to compare.
 * @param {Option} b - The second option to compare.
 * @returns {number} - Returns -1 if a < b, 1 if a > b, 0 if a = b.
 */
function compareOptions(a: AccessPathOption, b: AccessPathOption): number {
  const positionalArgRegex = /^Argument\[\d+]$/;
  const keywordArgRegex = /^Argument\[[^\d:]+:]$/;
  const parameterRegex = /^Parameter\[\d+]$/;

  // Check for Argument[self]
  if (a.label === "Argument[self]" && b.label !== "Argument[self]") {
    return -1;
  } else if (b.label === "Argument[self]" && a.label !== "Argument[self]") {
    return 1;
  }

  // Check for positional arguments
  const aIsPositional = positionalArgRegex.test(a.label);
  const bIsPositional = positionalArgRegex.test(b.label);
  if (aIsPositional && bIsPositional) {
    return a.label.localeCompare(b.label, "en-US", { numeric: true });
  } else if (aIsPositional) {
    return -1;
  } else if (bIsPositional) {
    return 1;
  }

  // Check for keyword arguments
  const aIsKeyword = keywordArgRegex.test(a.label);
  const bIsKeyword = keywordArgRegex.test(b.label);
  if (aIsKeyword && bIsKeyword) {
    return a.label.localeCompare(b.label, "en-US");
  } else if (aIsKeyword) {
    return -1;
  } else if (bIsKeyword) {
    return 1;
  }

  // Check for Argument[block]
  if (a.label === "Argument[block]" && b.label !== "Argument[block]") {
    return -1;
  } else if (b.label === "Argument[block]" && a.label !== "Argument[block]") {
    return 1;
  }

  // Check for Argument[hash-splat]
  if (
    a.label === "Argument[hash-splat]" &&
    b.label !== "Argument[hash-splat]"
  ) {
    return -1;
  } else if (
    b.label === "Argument[hash-splat]" &&
    a.label !== "Argument[hash-splat]"
  ) {
    return 1;
  }

  // Check for parameters
  const aIsParameter = parameterRegex.test(a.label);
  const bIsParameter = parameterRegex.test(b.label);
  if (aIsParameter && bIsParameter) {
    return a.label.localeCompare(b.label, "en-US", { numeric: true });
  } else if (aIsParameter) {
    return -1;
  } else if (bIsParameter) {
    return 1;
  }

  // If none of the above rules apply, compare alphabetically
  return a.label.localeCompare(b.label, "en-US");
}
