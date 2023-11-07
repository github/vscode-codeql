import { parseAccessPathParts } from "./access-path";

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
      },
      {
        label: "Element[1]",
        icon: "symbol-field",
        value: "Argument[0].Element[1]",
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

  const parts = parseAccessPathParts(value);
  if (parts.length === 0) {
    return options;
  }
  const prefixParts = parts.slice(0, parts.length - 1);
  const lastPart = parts[parts.length - 1];

  const matchingOptions = findNestedMatchingOptions(prefixParts, options);

  return matchingOptions.filter((item) =>
    item.label.toLowerCase().includes(lastPart.toLowerCase()),
  );
}
