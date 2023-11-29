import { parseAccessPathTokens } from "./access-path";
import type { AccessPathOption } from "../../../model-editor/suggestions";

function findNestedMatchingOptions(
  parts: string[],
  options: AccessPathOption[],
): AccessPathOption[] {
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
  options: AccessPathOption[],
  value: string,
): AccessPathOption[] {
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
