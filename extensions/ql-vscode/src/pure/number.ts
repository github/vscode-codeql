/*
 * Contains an assortment of helper constants and functions for working with numbers.
 */

const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * Formats a number to be human-readable with decimal places and thousands separators.
 *
 * @param value The number to format.
 * @returns The formatted number. For example, "10,000", "1,000,000", or "1,000,000,000".
 */
export function formatDecimal(value: number): string {
  return numberFormatter.format(value);
}
