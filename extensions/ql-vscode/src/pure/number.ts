/*
 * Contains an assortment of helper constants and functions for working with numbers.
 */

const numberFormatter = new Intl.NumberFormat('en-US');

export function formatDecimal(value: number): string {
  return numberFormatter.format(value);
}
