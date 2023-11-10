import { parseAccessPathTokens } from "./access-path";
import type {
  BqrsCellValue,
  DecodedBqrsChunk,
} from "../../../common/bqrs-cli-types";

export type Option = {
  label: string;
  value: string;
  icon: string;
  details?: string;
  followup?: Option[];
};

export const suggestedOptions: Option[] = [
  {
    label: "Argument[self]",
    icon: "symbol-class",
    details: "sqlite3.SQLite3::Database",
    value: "Argument[self]",
  },
  {
    label: "Argument[0]",
    icon: "symbol-parameter",
    details: "name",
    value: "Argument[0]",
    followup: [
      {
        label: "Element[0]",
        icon: "symbol-field",
        value: "Argument[0].Element[0]",
        details: "first character",
      },
      {
        label: "Element[1]",
        icon: "symbol-field",
        value: "Argument[0].Element[1]",
        details: "second character",
      },
      {
        label: "Element[any]",
        icon: "symbol-field",
        value: "Argument[0].Element[any]",
        details: "any character",
      },
    ],
  },
  {
    label: "Argument[1]",
    icon: "symbol-parameter",
    details: "arity",
    value: "Argument[1]",
  },
  {
    label: "Argument[text_rep:]",
    icon: "symbol-parameter",
    details: "text_rep:",
    value: "Argument[text_rep:]",
  },
  {
    label: "Argument[block]",
    icon: "symbol-parameter",
    details: "&block",
    value: "Argument[block]",
    followup: [
      {
        label: "Parameter[0]",
        icon: "symbol-parameter",
        value: "Argument[block].Parameter[0]",
        details: "val",
        followup: [
          {
            label: "Element[:query]",
            icon: "symbol-key",
            value: "Argument[block].Parameter[0].Element[:query]",
          },
          {
            label: "Element[:parameters]",
            icon: "symbol-key",
            value: "Argument[block].Parameter[0].Element[:parameters]",
          },
        ],
      },
      {
        label: "Parameter[1]",
        icon: "symbol-parameter",
        value: "Argument[block].Parameter[1]",
        details: "context",
        followup: [
          {
            label: "Field[@query]",
            icon: "symbol-field",
            value: "Argument[block].Parameter[1].Field[@query]",
          },
        ],
      },
    ],
  },
  {
    label: "ReturnValue",
    icon: "symbol-variable",
    details: undefined,
    value: "ReturnValue",
  },
];

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
function compareOptions(a: Option, b: Option): number {
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

function parseQueryResultsForPath(tuples: BqrsCellValue[][]): Option[] {
  const optionsByParentPath = new Map<string, Option[]>();

  for (const tuple of tuples) {
    const value = tuple[2] as string;
    const details = tuple[3] as string;
    const defType = tuple[4] as string;

    const tokens = parseAccessPathTokens(value);
    const lastToken = tokens[tokens.length - 1];

    const parentPath = tokens
      .slice(0, tokens.length - 1)
      .map((token) => token.text)
      .join(".");

    const option: Option = {
      label: lastToken.text,
      value,
      details,
      icon: `symbol-${defType.toLowerCase()}`,
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
 * Parses the query results from a BQRS chunk to a list of options per type/method.
 *
 * @param chunk The chunk to parse.
 * @return A map from type -> method -> options
 */
export function parseQueryResults(
  chunk: DecodedBqrsChunk,
): Record<string, Record<string, Option[]>> {
  const tuplesByTypeAndPath = new Map<string, Map<string, BqrsCellValue[][]>>();

  for (const tuple of chunk.tuples) {
    const type = tuple[0] as string;
    const path = tuple[1] as string;

    if (!tuplesByTypeAndPath.has(type)) {
      tuplesByTypeAndPath.set(type, new Map());
    }

    const tuplesByMethod = tuplesByTypeAndPath.get(type);
    if (!tuplesByMethod) {
      throw new Error(
        "Expected resultsByTypeAndMethod to have a value for type",
      );
    }

    if (!tuplesByMethod.has(path)) {
      tuplesByMethod.set(path, []);
    }

    const tuples = tuplesByMethod.get(path);
    if (!tuples) {
      throw new Error("Expected resultsByMethod to have a value for path");
    }

    tuples.push(tuple);
  }

  const result: Record<string, Record<string, Option[]>> = {};

  for (const [type, resultsByMethod] of tuplesByTypeAndPath) {
    for (const [path, results] of resultsByMethod) {
      const options = parseQueryResultsForPath(results);

      if (!result[type]) {
        result[type] = {};
      }

      result[type][path] = options;
    }
  }

  return result;
}

function findNestedMatchingOptions(
  parts: string[],
  options: Option[],
): Option[] {
  const part = parts[0];
  const rest = parts.slice(1);

  if (!part) {
    return options;
  }

  const matchingOption = options.find((item) => item.label === part);
  if (!matchingOption) {
    return [];
  }

  if (rest.length === 0) {
    return matchingOption.followup ?? [];
  }

  return findNestedMatchingOptions(rest, matchingOption.followup ?? []);
}

export function findMatchingOptions(
  options: Option[],
  value: string,
): Option[] {
  if (!value) {
    return options;
  }

  const parts = parseAccessPathTokens(value);
  if (parts.length === 0) {
    return options;
  }
  const prefixTokens = parts.slice(0, parts.length - 1);
  const lastToken = parts[parts.length - 1];

  const matchingOptions = findNestedMatchingOptions(
    prefixTokens.map((token) => token.text),
    options,
  );

  return matchingOptions.filter((item) =>
    item.label.toLowerCase().includes(lastToken.text.toLowerCase()),
  );
}
