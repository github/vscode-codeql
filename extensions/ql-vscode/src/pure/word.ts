/**
 * Pluralizes a word.
 * Example: Returns "N repository" if N is one, "N repositories" otherwise.
 */

export function pluralize(
  numItems: number | undefined,
  singular: string,
  plural: string,
): string {
  return numItems !== undefined
    ? `${numItems} ${numItems === 1 ? singular : plural}`
    : "";
}
