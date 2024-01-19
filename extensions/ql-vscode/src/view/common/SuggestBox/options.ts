export type Option<T extends Option<T>> = {
  label: string;
  value: string;
  followup?: T[];
};

function findNestedMatchingOptions<T extends Option<T>>(
  parts: string[],
  options: T[],
): T[] {
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

export function findMatchingOptions<T extends Option<T>>(
  options: T[],
  tokens: string[],
): T[] {
  if (tokens.length === 0) {
    return options;
  }
  const prefixTokens = tokens.slice(0, tokens.length - 1);
  const lastToken = tokens[tokens.length - 1];

  const matchingOptions = findNestedMatchingOptions(prefixTokens, options);

  return matchingOptions.filter((item) =>
    item.label.toLowerCase().includes(lastToken.toLowerCase()),
  );
}
