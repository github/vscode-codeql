/*
 * Contains an assortment of helper constants and functions for working with time, dates, and durations.
 */

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = ONE_SECOND_IN_MS * 60;
export const ONE_HOUR_IN_MS = ONE_MINUTE_IN_MS * 60;
export const TWO_HOURS_IN_MS = ONE_HOUR_IN_MS * 2;
export const THREE_HOURS_IN_MS = ONE_HOUR_IN_MS * 3;
export const ONE_DAY_IN_MS = ONE_HOUR_IN_MS * 24;

// These are approximations
const ONE_MONTH_IN_MS = ONE_DAY_IN_MS * 30;
const ONE_YEAR_IN_MS = ONE_DAY_IN_MS * 365;

const durationFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/**
 * Converts a number of milliseconds into a human-readable string with units, indicating a relative time in the past or future.
 *
 * @param relativeTimeMillis The duration in milliseconds. A negative number indicates a duration in the past. And a positive number is
 *  the future.
 * @returns A humanized duration. For example, "in 2 minutes", "2 minutes ago", "yesterday", or "tomorrow".
 */
export function humanizeRelativeTime(relativeTimeMillis?: number) {
  if (relativeTimeMillis === undefined) {
    return "";
  }

  // If the time is in the past, we need -3_600_035 to be formatted as "1 hour ago" instead of "2 hours ago"
  const round = relativeTimeMillis < 0 ? Math.ceil : Math.floor;

  if (Math.abs(relativeTimeMillis) < ONE_HOUR_IN_MS) {
    return durationFormatter.format(
      round(relativeTimeMillis / ONE_MINUTE_IN_MS),
      "minute",
    );
  } else if (Math.abs(relativeTimeMillis) < ONE_DAY_IN_MS) {
    return durationFormatter.format(
      round(relativeTimeMillis / ONE_HOUR_IN_MS),
      "hour",
    );
  } else if (Math.abs(relativeTimeMillis) < ONE_MONTH_IN_MS) {
    return durationFormatter.format(
      round(relativeTimeMillis / ONE_DAY_IN_MS),
      "day",
    );
  } else if (Math.abs(relativeTimeMillis) < ONE_YEAR_IN_MS) {
    return durationFormatter.format(
      round(relativeTimeMillis / ONE_MONTH_IN_MS),
      "month",
    );
  } else {
    return durationFormatter.format(
      round(relativeTimeMillis / ONE_YEAR_IN_MS),
      "year",
    );
  }
}

/**
 * Converts a number of milliseconds into a human-readable string with units, indicating an amount of time.
 * Negative numbers have no meaning and are considered to be "Less than a second".
 *
 * @param millis The number of milliseconds to convert.
 * @returns A humanized duration. For example, "2 seconds", "2 minutes", "2 hours", "2 days", or "2 months".
 */
export function humanizeUnit(millis?: number): string {
  // assume a blank or empty string is a zero
  // assume anything less than 0 is a zero
  if (!millis || millis < ONE_SECOND_IN_MS) {
    return "Less than a second";
  }
  let unit: string;
  let unitDiff: number;
  if (millis < ONE_MINUTE_IN_MS) {
    unit = "second";
    unitDiff = Math.floor(millis / ONE_SECOND_IN_MS);
  } else if (millis < ONE_HOUR_IN_MS) {
    unit = "minute";
    unitDiff = Math.floor(millis / ONE_MINUTE_IN_MS);
  } else if (millis < ONE_DAY_IN_MS) {
    unit = "hour";
    unitDiff = Math.floor(millis / ONE_HOUR_IN_MS);
  } else if (millis < ONE_MONTH_IN_MS) {
    unit = "day";
    unitDiff = Math.floor(millis / ONE_DAY_IN_MS);
  } else if (millis < ONE_YEAR_IN_MS) {
    unit = "month";
    unitDiff = Math.floor(millis / ONE_MONTH_IN_MS);
  } else {
    unit = "year";
    unitDiff = Math.floor(millis / ONE_YEAR_IN_MS);
  }

  return createFormatter(unit).format(unitDiff);
}

function createFormatter(unit: string) {
  return Intl.NumberFormat("en-US", {
    style: "unit",
    unit,
    unitDisplay: "long",
  });
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
