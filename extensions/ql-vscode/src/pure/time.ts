/*
 * Contains an assortment of helper constants and functions for working with time, dates, and durations.
 */

export const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
export const ONE_HOUR_IN_MS = 1000 * 60 * 60;
export const TWO_HOURS_IN_MS = 1000 * 60 * 60 * 2;
export const THREE_HOURS_IN_MS = 1000 * 60 * 60 * 3;

const durationFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

// Months and years are approximate
const MINUTE_IN_MILLIS = 1000 * 60;
const HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS;
const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS;
const MONTH_IN_MILLIS = 30 * DAY_IN_MILLIS;
const YEAR_IN_MILLIS = 365 * DAY_IN_MILLIS;

/**
 * Converts a number of milliseconds into a human-readable string with units, indicating a relative time in the past or future.
 *
 * @param relativeTimeMillis The duration in milliseconds. A negative number indicates a duration in the past. And a positive number is
 *  the future.
 * @returns A humanized duration. For example, "in 2 minutes", "2 minutes ago", "yesterday", or "tomorrow".
 */
export function humanizeRelativeTime(relativeTimeMillis?: number) {
  if (relativeTimeMillis === undefined) {
    return '';
  }

  if (Math.abs(relativeTimeMillis) < HOUR_IN_MILLIS) {
    return durationFormatter.format(Math.floor(relativeTimeMillis / MINUTE_IN_MILLIS), 'minute');
  } else if (Math.abs(relativeTimeMillis) < DAY_IN_MILLIS) {
    return durationFormatter.format(Math.floor(relativeTimeMillis / HOUR_IN_MILLIS), 'hour');
  } else if (Math.abs(relativeTimeMillis) < MONTH_IN_MILLIS) {
    return durationFormatter.format(Math.floor(relativeTimeMillis / DAY_IN_MILLIS), 'day');
  } else if (Math.abs(relativeTimeMillis) < YEAR_IN_MILLIS) {
    return durationFormatter.format(Math.floor(relativeTimeMillis / MONTH_IN_MILLIS), 'month');
  } else {
    return durationFormatter.format(Math.floor(relativeTimeMillis / YEAR_IN_MILLIS), 'year');
  }
}

/**
 * Converts a number of milliseconds into a human-readable string with units, indicating an amount of time.
 * Negative numbers have no meaning and are considered to be "Less than a minute".
 *
 * @param millis The number of milliseconds to convert.
 * @returns A humanized duration. For example, "2 minutes", "2 hours", "2 days", or "2 months".
 */
export function humanizeUnit(millis?: number): string {
  // assume a blank or empty string is a zero
  // assume anything less than 0 is a zero
  if (!millis || millis < MINUTE_IN_MILLIS) {
    return 'Less than a minute';
  }
  let unit: string;
  let unitDiff: number;
  if (millis < HOUR_IN_MILLIS) {
    unit = 'minute';
    unitDiff = Math.floor(millis / MINUTE_IN_MILLIS);
  } else if (millis < DAY_IN_MILLIS) {
    unit = 'hour';
    unitDiff = Math.floor(millis / HOUR_IN_MILLIS);
  } else if (millis < MONTH_IN_MILLIS) {
    unit = 'day';
    unitDiff = Math.floor(millis / DAY_IN_MILLIS);
  } else if (millis < YEAR_IN_MILLIS) {
    unit = 'month';
    unitDiff = Math.floor(millis / MONTH_IN_MILLIS);
  } else {
    unit = 'year';
    unitDiff = Math.floor(millis / YEAR_IN_MILLIS);
  }

  return createFormatter(unit).format(unitDiff);
}

function createFormatter(unit: string) {
  return Intl.NumberFormat('en-US', {
    style: 'unit',
    unit,
    unitDisplay: 'long'
  });
}
