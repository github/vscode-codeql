/*
 * Contains an assortment of helper constants and functions for working with dates.
 */

const dateWithoutYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: Date): string {
  if (value.getFullYear() === new Date().getFullYear()) {
    return dateWithoutYearFormatter.format(value);
  }

  return dateFormatter.format(value);
}

// These are overloads for the function that allow us to not add an extra
// type check when the value is definitely not undefined.
export function parseDate(value: string): Date;
export function parseDate(value: string | undefined | null): Date | undefined;

export function parseDate(value: string | undefined | null): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return new Date(value);
}
