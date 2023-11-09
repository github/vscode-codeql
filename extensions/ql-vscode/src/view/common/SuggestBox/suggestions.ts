import { parseAccessPathTokens } from "./access-path";

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
