/*
 * Contains an assortment of helper constants and functions for working with dates.
 */

const dateWithoutYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDate(value: Date): string {
  if (value.getFullYear() === new Date().getFullYear()) {
    return dateWithoutYearFormatter.format(value);
  }

  return dateFormatter.format(value);
}
