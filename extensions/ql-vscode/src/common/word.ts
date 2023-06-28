/**
 * Pluralizes a word.
 * Example: Returns "N repository" if N is one, "N repositories" otherwise.
 */

export function pluralize(
  numItems: number | undefined,
  singular: string,
  plural: string,
  numberFormatter: (value: number) => string = (value) => value.toString(),
): string {
  return numItems !== undefined
    ? `${numberFormatter(numItems)} ${numItems === 1 ? singular : plural}`
    : "";
}
